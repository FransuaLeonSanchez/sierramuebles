import os
import sys
from PIL import Image, ImageOps
from rembg import remove, new_session
from tqdm import tqdm
from typing import Tuple, Optional
import numpy as np


def get_bbox(img: Image.Image) -> Tuple[int, int, int, int]:
    """
    Obtiene el bounding box de la imagen sin transparencia.
    Retorna (left, top, right, bottom)
    """
    # Convertir a array y obtener canal alpha
    img_array = np.array(img)
    alpha = img_array[:, :, 3]

    # Encontrar coordenadas de píxeles no transparentes
    coords = np.argwhere(alpha > 0)
    if len(coords) == 0:
        return (0, 0, img.width, img.height)

    # Obtener límites
    y0, x0 = coords.min(axis=0)
    y1, x1 = coords.max(axis=0)

    # Añadir un pequeño padding
    padding = 10
    x0 = max(0, x0 - padding)
    y0 = max(0, y0 - padding)
    x1 = min(img.width, x1 + padding)
    y1 = min(img.height, y1 + padding)

    return (x0, y0, x1, y1)


class ImageProcessor:
    def __init__(self, input_dir: str = "imagenes", output_dir: str = "imagenes_modificadas"):
        self.input_dir = input_dir
        self.output_dir = output_dir
        self.valid_extensions = {'.jpg', '.jpeg', '.png'}
        self.session = None

    def initialize_session(self):
        """Inicializa la sesión de rembg"""
        self.session = new_session(
            model_name="u2net",
            providers=['CPUExecutionProvider']
        )

    def create_output_directory(self):
        """Crea el directorio de salida si no existe"""
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)
            print(f"Directorio creado: {self.output_dir}")

    def is_valid_image(self, filename: str) -> bool:
        """Verifica si el archivo es una imagen válida"""
        return os.path.splitext(filename)[1].lower() in self.valid_extensions

    def process_single_image(self, input_path: str, output_path: str) -> Optional[str]:
        """Procesa una sola imagen"""
        try:
            with Image.open(input_path) as input_image:
                # Convertir a RGB si es necesario
                if input_image.mode != 'RGB':
                    input_image = input_image.convert('RGB')

                # Remover fondo
                output_image = remove(
                    input_image,
                    session=self.session,
                    alpha_matting=True,
                    alpha_matting_foreground_threshold=250,
                    alpha_matting_background_threshold=0,
                    alpha_matting_erode_size=0,
                    post_process_mask=False,
                    alpha_matting_kernel_size=3
                )

                # Obtener el bounding box y recortar
                bbox = get_bbox(output_image)
                output_image = output_image.crop(bbox)

                # Guardar imagen
                output_image.save(
                    output_path,
                    'PNG',
                    quality=100,
                    optimize=False
                )

                return output_path
        except Exception as e:
            print(f"\nError al procesar {input_path}: {str(e)}")
            return None

    def process_batch(self):
        """Procesa un lote de imágenes"""
        try:
            if not os.path.exists(self.input_dir):
                raise FileNotFoundError(f"No se encontró el directorio de entrada: {self.input_dir}")

            self.create_output_directory()
            self.initialize_session()

            # Obtener lista de imágenes válidas
            valid_images = [f for f in os.listdir(self.input_dir) if self.is_valid_image(f)]

            if not valid_images:
                print("No se encontraron imágenes válidas en el directorio")
                return

            print(f"Procesando {len(valid_images)} imágenes...")

            # Procesar imágenes con barra de progreso
            processed_files = []
            for filename in tqdm(valid_images, desc="Procesando imágenes"):
                input_path = os.path.join(self.input_dir, filename)
                output_path = os.path.join(
                    self.output_dir,
                    os.path.splitext(filename)[0] + '.png'
                )

                result = self.process_single_image(input_path, output_path)
                if result:
                    processed_files.append(result)

            print("\n¡Proceso completado!")
            print(f"Imágenes procesadas: {len(processed_files)}")
            print(f"Las imágenes se encuentran en: {self.output_dir}")

        except Exception as e:
            print(f"Error general: {str(e)}")


def main():
    input_dir = sys.argv[1] if len(sys.argv) > 1 else "images"
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "imagenes_modificadas"

    processor = ImageProcessor(input_dir, output_dir)
    processor.process_batch()


if __name__ == "__main__":
    main()