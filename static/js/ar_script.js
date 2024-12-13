document.addEventListener('DOMContentLoaded', function() {
    const backgroundPreview = document.getElementById('backgroundPreview');
    const backgroundInput = document.getElementById('backgroundInput');
    const backgroundImage = document.getElementById('backgroundImage');
    const uploadPrompt = document.getElementById('uploadPrompt');
    const foldersList = document.getElementById('foldersList');
    const downloadBtn = document.getElementById('downloadBtn');
    const saveBtn = document.getElementById('saveBtn');
    let selectedFolder = null;
    let objects = [];
    let backgroundImageLoaded = false;

    async function loadFolders() {
        try {
            const response = await fetch('/get_folders');
            const data = await response.json();

            if (data.folders) {
                foldersList.innerHTML = data.folders
                    .map(folder => `
                        <li class="folder-item" data-folder="${folder}">
                            ${folder}
                        </li>
                    `)
                    .join('');

                document.querySelectorAll('.folder-item').forEach(item => {
                    item.addEventListener('click', async () => {
                        document.querySelectorAll('.folder-item').forEach(i => i.classList.remove('selected'));
                        item.classList.add('selected');
                        selectedFolder = item.dataset.folder;
                        await loadObjectImage(selectedFolder);
                    });
                });
            }
        } catch (error) {
            console.error('Error cargando carpetas:', error);
        }
    }

    async function loadObjectImage(folderName) {
        try {
            const response = await fetch(`/get_folder_images/${folderName}`);
            const data = await response.json();

            if (data.images && data.images.length > 0) {
                createDraggableObject(data.images[0], data.images);
            }
        } catch (error) {
            console.error('Error cargando imagen:', error);
        }
    }

    async function saveComposition() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const bgRect = backgroundImage.getBoundingClientRect();
        canvas.width = bgRect.width;
        canvas.height = bgRect.height;
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

        objects.forEach(obj => {
            const objRect = obj.getBoundingClientRect();
            const img = obj.querySelector('.draggable-image');
            const container = obj.querySelector('.object-container');
            const rotation = container.style.transform || 'rotate(0deg)';
            const angle = parseInt(rotation.match(/rotate\((\d+)deg\)/) ? rotation.match(/rotate\((\d+)deg\)/)[1] : 0);

            const relativeLeft = objRect.left - bgRect.left;
            const relativeTop = objRect.top - bgRect.top;

            ctx.save();
            ctx.translate(relativeLeft + objRect.width/2, relativeTop + objRect.height/2);
            ctx.rotate(angle * Math.PI / 180);

            let imgWidth = objRect.width;
            let imgHeight = objRect.height;

            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                const aspectRatio = img.naturalWidth / img.naturalHeight;
                if (imgWidth / imgHeight > aspectRatio) {
                    imgWidth = imgHeight * aspectRatio;
                } else {
                    imgHeight = imgWidth / aspectRatio;
                }
            }

            ctx.drawImage(img, -imgWidth/2, -imgHeight/2, imgWidth, imgHeight);
            ctx.restore();
        });

        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

        try {
            const response = await fetch('/save_composition', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ image: dataUrl })
            });

            if (response.ok) {
                showNotification('Composición guardada exitosamente', 'success');
            } else {
                showNotification('Error al guardar la composición', 'error');
            }
        } catch (error) {
            console.error('Error al guardar la composición:', error);
            showNotification('Error al guardar la composición', 'error');
        }
    }

    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.classList.add('notification', type);
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    function createDraggableObject(imagePath, imagesList) {
        const draggableObject = document.createElement('div');
        draggableObject.className = 'draggable-object';
        draggableObject.style.width = '200px';
        draggableObject.style.height = '200px';

        // Guardar la lista de imágenes y el índice actual
        draggableObject.dataset.images = JSON.stringify(imagesList);
        draggableObject.dataset.currentImageIndex = '0';

        const objectContainer = document.createElement('div');
        objectContainer.className = 'object-container';

        const img = document.createElement('img');
        img.src = imagePath;
        img.className = 'draggable-image';
        img.onerror = function() {
            console.error('Error cargando imagen:', imagePath);
        };

        const controls = document.createElement('div');
        controls.className = 'object-controls';
        controls.innerHTML = `
            <button class="control-btn remove-btn">×</button>
            <button class="control-btn switch-btn">↔</button>
            <button class="control-btn rotate-btn">⟳</button>
        `;

        const resizePoints = document.createElement('div');
        resizePoints.className = 'resize-points';
        ['nw', 'ne', 'sw', 'se'].forEach(point => {
            const resizePoint = document.createElement('div');
            resizePoint.className = `resize-point ${point}`;
            resizePoints.appendChild(resizePoint);
        });

        objectContainer.appendChild(img);
        draggableObject.appendChild(objectContainer);
        draggableObject.appendChild(controls);
        draggableObject.appendChild(resizePoints);

        // Posicionar dentro de la imagen de fondo
        const imgRect = backgroundImage.getBoundingClientRect();
        const previewRect = backgroundPreview.getBoundingClientRect();
        const imgLeft = imgRect.left - previewRect.left;
        const imgTop = imgRect.top - previewRect.top;
        draggableObject.style.left = `${imgLeft + (imgRect.width - 200) / 2}px`;
        draggableObject.style.top = `${imgTop + (imgRect.height - 200) / 2}px`;

        backgroundPreview.appendChild(draggableObject);
        objects.push(draggableObject);

        makeDraggable(draggableObject);
        makeResizable(draggableObject);
        setupControls(draggableObject);
    }

    function makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        element.style.cursor = 'move';

        element.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            if (e.target.classList.contains('resize-point') ||
                e.target.classList.contains('control-btn')) {
                return;
            }
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;

            objects.forEach(obj => obj.style.zIndex = "1");
            element.style.zIndex = "2";
        }

        function elementDrag(e) {
            e.preventDefault();
            const imgRect = backgroundImage.getBoundingClientRect();
            const elementRect = element.getBoundingClientRect();
            const previewRect = backgroundPreview.getBoundingClientRect();

            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;

            const imgTop = imgRect.top - previewRect.top;
            const imgBottom = imgRect.bottom - previewRect.top;
            const imgLeft = imgRect.left - previewRect.left;
            const imgRight = imgRect.right - previewRect.left;

            let newLeft = element.offsetLeft - pos1;
            let newTop = element.offsetTop - pos2;

            newLeft = Math.max(imgLeft, Math.min(newLeft, imgRight - elementRect.width));
            newTop = Math.max(imgTop, Math.min(newTop, imgBottom - elementRect.height));

            element.style.left = newLeft + "px";
            element.style.top = newTop + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    function makeResizable(element) {
        const resizePoints = element.querySelectorAll('.resize-point');

        resizePoints.forEach(point => {
            point.addEventListener('mousedown', initResize);
        });

        function initResize(e) {
            e.preventDefault();
            e.stopPropagation();

            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = element.offsetWidth;
            const startHeight = element.offsetHeight;
            const startLeft = parseInt(element.style.left);
            const startTop = parseInt(element.style.top);
            const point = e.target;

            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);

            function resize(e) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                if (point.classList.contains('se')) {
                    element.style.width = `${startWidth + dx}px`;
                    element.style.height = `${startHeight + dy}px`;
                }
                else if (point.classList.contains('sw')) {
                    element.style.width = `${startWidth - dx}px`;
                    element.style.height = `${startHeight + dy}px`;
                    element.style.left = `${startLeft + dx}px`;
                }
                else if (point.classList.contains('ne')) {
                    element.style.width = `${startWidth + dx}px`;
                    element.style.height = `${startHeight - dy}px`;
                    element.style.top = `${startTop + dy}px`;
                }
                else if (point.classList.contains('nw')) {
                    element.style.width = `${startWidth - dx}px`;
                    element.style.height = `${startHeight - dy}px`;
                    element.style.left = `${startLeft + dx}px`;
                    element.style.top = `${startTop + dy}px`;
                }
            }

            function stopResize() {
                document.removeEventListener('mousemove', resize);
                document.removeEventListener('mouseup', stopResize);
            }
        }
    }

    function setupControls(element) {
        const removeBtn = element.querySelector('.remove-btn');
        const rotateBtn = element.querySelector('.rotate-btn');
        const switchBtn = element.querySelector('.switch-btn');
        let rotation = 0;

        removeBtn.addEventListener('click', () => {
            element.remove();
            objects = objects.filter(obj => obj !== element);
        });

        rotateBtn.addEventListener('click', () => {
            rotation = (rotation + 90) % 360;
            element.querySelector('.object-container').style.transform = `rotate(${rotation}deg)`;
        });

        switchBtn.addEventListener('click', () => {
            const images = JSON.parse(element.dataset.images);
            let currentIndex = parseInt(element.dataset.currentImageIndex);
            currentIndex = (currentIndex + 1) % images.length;
            element.dataset.currentImageIndex = currentIndex.toString();

            const currentWidth = element.style.width;
            const currentHeight = element.style.height;

            const img = element.querySelector('.draggable-image');
            img.src = images[currentIndex];

            element.style.width = currentWidth;
            element.style.height = currentHeight;
        });
    }

    function downloadComposition() {
        // Crear un canvas temporal del tamaño de la imagen de fondo
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Obtener dimensiones de la imagen de fondo
        const bgRect = backgroundImage.getBoundingClientRect();
        canvas.width = bgRect.width;
        canvas.height = bgRect.height;

        // Dibujar la imagen de fondo
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

        // Dibujar cada objeto en su posición y tamaño actuales
        objects.forEach(obj => {
            const objRect = obj.getBoundingClientRect();
            const img = obj.querySelector('.draggable-image');
            const container = obj.querySelector('.object-container');
            const rotation = container.style.transform || 'rotate(0deg)';
            const angle = parseInt(rotation.match(/rotate\((\d+)deg\)/) ? rotation.match(/rotate\((\d+)deg\)/)[1] : 0);

            // Calcular posición relativa al canvas
            const relativeLeft = objRect.left - bgRect.left;
            const relativeTop = objRect.top - bgRect.top;

            // Guardar el estado actual del contexto
            ctx.save();

            // Trasladar y rotar el contexto
            ctx.translate(relativeLeft + objRect.width/2, relativeTop + objRect.height/2);
            ctx.rotate(angle * Math.PI / 180);

            // Calcular las dimensiones de la imagen manteniendo la proporción
            let imgWidth = objRect.width;
            let imgHeight = objRect.height;

            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                const aspectRatio = img.naturalWidth / img.naturalHeight;
                if (imgWidth / imgHeight > aspectRatio) {
                    imgWidth = imgHeight * aspectRatio;
                } else {
                    imgHeight = imgWidth / aspectRatio;
                }
            }

            // Dibujar la imagen con las dimensiones ajustadas
            ctx.drawImage(img, -imgWidth/2, -imgHeight/2, imgWidth, imgHeight);

            // Restaurar el estado del contexto
            ctx.restore();
        });

        // Convertir el canvas a una URL de datos y descargar
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const link = document.createElement('a');
        link.download = 'composicion.jpg';
        link.href = dataUrl;
        link.click();
    }

    async function saveComposition() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const bgRect = backgroundImage.getBoundingClientRect();
    canvas.width = bgRect.width;
    canvas.height = bgRect.height;
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

    objects.forEach(obj => {
        const objRect = obj.getBoundingClientRect();
        const img = obj.querySelector('.draggable-image');
        const container = obj.querySelector('.object-container');
        const rotation = container.style.transform || 'rotate(0deg)';
        const angle = parseInt(rotation.match(/rotate\((\d+)deg\)/) ? rotation.match(/rotate\((\d+)deg\)/)[1] : 0);

        const relativeLeft = objRect.left - bgRect.left;
        const relativeTop = objRect.top - bgRect.top;

        ctx.save();
        ctx.translate(relativeLeft + objRect.width/2, relativeTop + objRect.height/2);
        ctx.rotate(angle * Math.PI / 180);

        let imgWidth = objRect.width;
        let imgHeight = objRect.height;

        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            if (imgWidth / imgHeight > aspectRatio) {
                imgWidth = imgHeight * aspectRatio;
            } else {
                imgHeight = imgWidth / aspectRatio;
            }
        }

        ctx.drawImage(img, -imgWidth/2, -imgHeight/2, imgWidth, imgHeight);
        ctx.restore();
    });

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    try {
        const response = await fetch('/save_composition', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ image: dataUrl })
        });

        if (response.ok) {
            showNotification('Composición guardada exitosamente');
        } else {
            showNotification('Error al guardar la composición', 'error');
        }
    } catch (error) {
        console.error('Error al guardar la composición:', error);
        showNotification('Error al guardar la composición', 'error');
    }
}

    function handleBackgroundImage(file) {
        if (backgroundImageLoaded) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            backgroundImage.src = e.target.result;
            backgroundImage.style.display = 'block';
            uploadPrompt.style.display = 'none';

            backgroundImage.onload = function() {
                const aspectRatio = this.naturalWidth / this.naturalHeight;
                const maxWidth = backgroundPreview.offsetWidth;
                const maxHeight = Math.min(window.innerHeight * 0.7, maxWidth / aspectRatio);

                backgroundPreview.style.height = `${maxHeight}px`;
                this.style.maxHeight = '100%';
                this.style.maxWidth = '100%';
                this.style.position = 'absolute';
                this.style.left = '50%';
                this.style.top = '50%';
                this.style.transform = 'translate(-50%, -50%)';

                backgroundImageLoaded = true;
                backgroundPreview.style.cursor = 'default';

                backgroundPreview.removeEventListener('click', handlePreviewClick);
                backgroundPreview.removeEventListener('dragover', handleDragOver);
                backgroundPreview.removeEventListener('drop', handleDrop);
            };
        };
        reader.readAsDataURL(file);
    }

    function handlePreviewClick(e) {
        if (!backgroundImageLoaded && (e.target === backgroundPreview || e.target === uploadPrompt)) {
            backgroundInput.click();
        }
    }

    function handleDragOver(e) {
        if (!backgroundImageLoaded) {
            e.preventDefault();
            backgroundPreview.classList.add('dragover');
        }
    }

    function handleDrop(e) {
        if (!backgroundImageLoaded) {
            e.preventDefault();
            backgroundPreview.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                handleBackgroundImage(files[0]);
            }
        }
    }

    backgroundPreview.addEventListener('click', handlePreviewClick);
    backgroundPreview.addEventListener('dragover', handleDragOver);
    saveBtn.addEventListener('click', saveComposition);
    backgroundPreview.addEventListener('dragleave', () => {
        backgroundPreview.classList.remove('dragover');
    });
    backgroundPreview.addEventListener('drop', handleDrop);
    downloadBtn.addEventListener('click', downloadComposition);
    backgroundInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleBackgroundImage(e.target.files[0]);
        }
    });

    loadFolders();
});