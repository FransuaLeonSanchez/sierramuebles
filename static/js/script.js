const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const uploadBtn = document.getElementById('uploadBtn');
const status = document.getElementById('status');
const baseName = document.getElementById('baseName');
let files = [];

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

dropZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

baseName.addEventListener('input', validateForm);

function handleFiles(newFiles) {
    const imageFiles = Array.from(newFiles).filter(file => file.type.startsWith('image/'));
    files = [...files, ...imageFiles];
    updatePreview();
    validateForm();
}

function updatePreview() {
    preview.innerHTML = '';
    files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `
                <div class="preview-container">
                    <div class="image-controls">
                        <button class="control-btn rotate-btn" onclick="rotateImage(this)">⟳</button>
                        <button class="control-btn remove-btn" onclick="removeFile(${index})">×</button>
                    </div>
                    <div class="image-wrapper">
                        <img src="${e.target.result}" alt="Preview" data-rotation="0">
                    </div>
                </div>
            `;
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function removeFile(index) {
    files.splice(index, 1);
    updatePreview();
    validateForm();
}

function rotateImage(button) {
    const previewItem = button.closest('.preview-item');
    const img = previewItem.querySelector('img');

    const currentRotation = parseInt(img.getAttribute('data-rotation') || 0);
    const newRotation = (currentRotation + 90) % 360;

    img.style.transform = `rotate(${newRotation}deg)`;
    img.setAttribute('data-rotation', newRotation);
}

function validateForm() {
    uploadBtn.disabled = files.length === 0 || !baseName.value.trim();
}

uploadBtn.addEventListener('click', async () => {
    if (files.length === 0 || !baseName.value.trim()) return;

    const formData = new FormData();
    files.forEach(file => {
        formData.append('files[]', file);
    });
    formData.append('baseName', baseName.value.trim());

    // Agregar las rotaciones de cada imagen
    const rotations = Array.from(preview.querySelectorAll('img')).map(img => img.getAttribute('data-rotation'));
    rotations.forEach(rotation => {
        formData.append('rotations[]', rotation);
    });

    uploadBtn.disabled = true;
    status.innerHTML = 'Procesando imágenes...';
    status.className = '';

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        status.innerHTML = data.message;
        status.className = 'success';

        files = [];
        updatePreview();
        validateForm();
    } catch (error) {
        status.innerHTML = 'Error al procesar las imágenes';
        status.className = 'error';
    }

    uploadBtn.disabled = false;
});