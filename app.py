from flask import Flask, request, render_template, jsonify, send_from_directory, url_for
import os
import unidecode
import re
from rembg import remove, new_session
from PIL import Image
import numpy as np
import base64
import time

app = Flask(__name__)

# Configuración de directorios base
app.config['IMAGES_FOLDER'] = 'imagenes'
app.config['PROCESSED_IMAGES_FOLDER'] = 'imagenes_procesadas'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max-limit


def create_project_directories(project_name):
    """Crea los directorios necesarios para el proyecto"""
    original_dir = os.path.join(app.config['IMAGES_FOLDER'], project_name)
    processed_dir = os.path.join(app.config['PROCESSED_IMAGES_FOLDER'], project_name)
    os.makedirs(original_dir, exist_ok=True)
    os.makedirs(processed_dir, exist_ok=True)
    return original_dir, processed_dir


def sanitize_filename(filename):
    filename = unidecode.unidecode(filename)
    return re.sub(r'[^a-zA-Z0-9._-]', '_', filename)


def get_bbox(img):
    img_array = np.array(img)
    alpha = img_array[:, :, 3]
    coords = np.argwhere(alpha > 0)

    if len(coords) == 0:
        return (0, 0, img.width, img.height)

    y0, x0 = coords.min(axis=0)
    y1, x1 = coords.max(axis=0)

    padding = 10
    return (
        max(0, x0 - padding),
        max(0, y0 - padding),
        min(img.width, x1 + padding),
        min(img.height, y1 + padding)
    )


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/ar')
def ar():
    return render_template('ar.html')


@app.route('/saved-models')
def saved_models():
    return render_template('saved_models.html')


@app.route('/get_folders')
def get_folders():
    """Obtiene la lista de carpetas en el directorio de imágenes procesadas"""
    processed_dir = app.config['PROCESSED_IMAGES_FOLDER']
    try:
        folders = [f for f in os.listdir(processed_dir)
                   if os.path.isdir(os.path.join(processed_dir, f))]
        return jsonify({'folders': folders})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/get_folder_images/<folder>')
def get_folder_images(folder):
    processed_dir = os.path.join(app.config['PROCESSED_IMAGES_FOLDER'], folder)
    try:
        if os.path.exists(processed_dir):
            images = [f for f in os.listdir(processed_dir)
                      if f.endswith(('.png', '.jpg', '.jpeg'))]
            image_paths = []
            for img in images:
                image_url = f'/serve_image/{folder}/{img}'
                image_paths.append(image_url)
            return jsonify({'images': image_paths})
        return jsonify({'images': []})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/serve_image/<folder>/<filename>')
def serve_image(folder, filename):
    """Sirve las imágenes desde el directorio de imágenes procesadas"""
    return send_from_directory(
        os.path.join(app.config['PROCESSED_IMAGES_FOLDER'], folder),
        filename
    )


@app.route('/upload', methods=['POST'])
def upload_file():
    if 'files[]' not in request.files:
        return jsonify({'error': 'No se encontraron archivos'}), 400

    files = request.files.getlist('files[]')
    rotations = request.form.getlist('rotations[]')
    base_name = sanitize_filename(request.form.get('baseName', 'imagen'))

    original_dir, processed_dir = create_project_directories(base_name)
    processed_files = []
    errors = []

    session = new_session(model_name="u2net")

    for i, (file, rotation) in enumerate(zip(files, rotations), 1):
        if file:
            try:
                filename = f"{base_name}_{i}.png"
                input_path = os.path.join(original_dir, filename)
                output_path = os.path.join(processed_dir, filename)

                # Abrir y rotar la imagen original antes de guardarla
                original_image = Image.open(file)
                if int(rotation) != 0:
                    original_image = original_image.rotate(-int(rotation), expand=True)
                original_image.save(input_path, 'PNG', quality=100)

                # Procesar la imagen para remover fondo
                if original_image.mode != 'RGB':
                    original_image = original_image.convert('RGB')

                output_image = remove(
                    original_image,
                    session=session,
                    alpha_matting=True,
                    alpha_matting_foreground_threshold=250,
                    alpha_matting_background_threshold=0
                )

                output_image = output_image.crop(get_bbox(output_image))
                output_image.save(output_path, 'PNG', quality=100)
                processed_files.append(filename)

            except Exception as e:
                errors.append(f"Error procesando {file.filename}: {str(e)}")

    return jsonify({
        'processed': processed_files,
        'errors': errors,
        'message': f'Se procesaron {len(processed_files)} imágenes exitosamente'
    })


@app.route('/save_composition', methods=['POST'])
def save_composition():
    data = request.get_json()
    image_data = data.get('image')

    # Guardar la imagen en el servidor (puedes usar una base de datos o almacenarla en un directorio)
    # Por simplicidad, este ejemplo guarda la imagen en un directorio llamado 'saved_models'
    os.makedirs('saved_models', exist_ok=True)
    filename = f"model_{int(time.time())}.jpg"
    filepath = os.path.join('saved_models', filename)

    image_data = image_data.split(',')[1]
    image_data = base64.b64decode(image_data)

    with open(filepath, 'wb') as f:
        f.write(image_data)

    return jsonify({'message': 'Composición guardada exitosamente'})


@app.route('/get_saved_models')
def get_saved_models():
    saved_models_dir = 'saved_models'
    models = []

    if os.path.exists(saved_models_dir):
        for filename in os.listdir(saved_models_dir):
            if filename.endswith('.jpg'):
                models.append({
                    'filename': filename,
                    'url': url_for('serve_saved_model', filename=filename)
                })

    return jsonify({'models': models})

@app.route('/saved_models/<path:filename>')
def serve_saved_model(filename):
    return send_from_directory('saved_models', filename)

if __name__ == '__main__':
    os.makedirs(app.config['IMAGES_FOLDER'], exist_ok=True)
    os.makedirs(app.config['PROCESSED_IMAGES_FOLDER'], exist_ok=True)
    app.run(host="0.0.0.0", port=5000, debug=False)