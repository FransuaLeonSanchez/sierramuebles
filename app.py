from flask import Flask, request, render_template, jsonify
import os
from werkzeug.utils import secure_filename
import unidecode
import re
from rembg import remove, new_session
from PIL import Image
import numpy as np

app = Flask(__name__)

# Configuración
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['OUTPUT_FOLDER'] = 'static/processed'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max-limit

# Crear directorios si no existen
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)


def sanitize_filename(filename):
    # Quitar tildes y caracteres especiales
    filename = unidecode.unidecode(filename)
    # Reemplazar espacios y caracteres no permitidos con guiones bajos
    filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
    return filename


def get_bbox(img):
    """Obtiene el bounding box de la imagen sin transparencia"""
    img_array = np.array(img)
    alpha = img_array[:, :, 3]
    coords = np.argwhere(alpha > 0)

    if len(coords) == 0:
        return (0, 0, img.width, img.height)

    y0, x0 = coords.min(axis=0)
    y1, x1 = coords.max(axis=0)

    padding = 10
    x0 = max(0, x0 - padding)
    y0 = max(0, y0 - padding)
    x1 = min(img.width, x1 + padding)
    y1 = min(img.height, y1 + padding)

    return (x0, y0, x1, y1)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/upload', methods=['POST'])
def upload_file():
    if 'files[]' not in request.files:
        return jsonify({'error': 'No se encontraron archivos'}), 400

    files = request.files.getlist('files[]')
    rotations = request.form.getlist('rotations[]')
    base_name = request.form.get('baseName', 'imagen')
    base_name = sanitize_filename(base_name)

    processed_files = []
    errors = []

    session = new_session(model_name="u2net", providers=['CPUExecutionProvider'])

    for i, (file, rotation) in enumerate(zip(files, rotations), 1):
        if file:
            try:
                filename = f"{base_name}_{i}.png"
                input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                output_path = os.path.join(app.config['OUTPUT_FOLDER'], filename)

                # Guardar imagen
                file.save(input_path)
                with Image.open(input_path) as input_image:
                    if input_image.mode != 'RGB':
                        input_image = input_image.convert('RGB')

                    # Procesar imagen
                    output_image = remove(
                        input_image,
                        session=session,
                        alpha_matting=True,
                        alpha_matting_foreground_threshold=250,
                        alpha_matting_background_threshold=0,
                        alpha_matting_erode_size=0,
                        post_process_mask=False,
                        alpha_matting_kernel_size=3
                    )

                    # Recortar
                    bbox = get_bbox(output_image)
                    output_image = output_image.crop(bbox)

                    # Aplicar rotación si existe
                    rotation = int(rotation)
                    if rotation != 0:
                        output_image = output_image.rotate(-rotation, expand=True)

                    # Guardar imagen final
                    output_image.save(output_path, 'PNG', quality=100)
                    processed_files.append(filename)

            except Exception as e:
                errors.append(f"Error procesando {file.filename}: {str(e)}")

            finally:
                # Limpiar archivo temporal
                if os.path.exists(input_path):
                    os.remove(input_path)

    return jsonify({
        'processed': processed_files,
        'errors': errors,
        'message': f'Se procesaron {len(processed_files)} imágenes exitosamente'
    })


if __name__ == '__main__':
    app.run(debug=True)