document.addEventListener('DOMContentLoaded', function() {
    const backgroundPreview = document.getElementById('backgroundPreview');
    const backgroundInput = document.getElementById('backgroundInput');
    const backgroundImage = document.getElementById('backgroundImage');
    const uploadPrompt = document.getElementById('uploadPrompt');
    const foldersList = document.getElementById('foldersList');
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
                createDraggableObject(data.images[0]);
            }
        } catch (error) {
            console.error('Error cargando imagen:', error);
        }
    }

    function createDraggableObject(imagePath) {
        const draggableObject = document.createElement('div');
        draggableObject.className = 'draggable-object';
        draggableObject.style.width = '200px';
        draggableObject.style.height = '200px';

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
        draggableObject.style.left = `${(imgRect.width - 200) / 2}px`;
        draggableObject.style.top = `${(imgRect.height - 200) / 2}px`;

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

            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;

            let newLeft = element.offsetLeft - pos1;
            let newTop = element.offsetTop - pos2;

            // Limitar al área de la imagen
            newLeft = Math.max(0, Math.min(newLeft, imgRect.width - elementRect.width));
            newTop = Math.max(0, Math.min(newTop, imgRect.height - elementRect.height));

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
            const startLeft = element.offsetLeft;
            const startTop = element.offsetTop;
            const point = e.target;
            const aspectRatio = startWidth / startHeight;

            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);

            function resize(e) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                let newWidth, newHeight;

                if (point.classList.contains('se')) {
                    newWidth = startWidth + dx;
                    newHeight = newWidth / aspectRatio;
                } else if (point.classList.contains('sw')) {
                    newWidth = startWidth - dx;
                    newHeight = newWidth / aspectRatio;
                    if (newWidth > 50 && newHeight > 50) {
                        element.style.left = `${startLeft + dx}px`;
                    }
                } else if (point.classList.contains('ne')) {
                    newWidth = startWidth + dx;
                    newHeight = newWidth / aspectRatio;
                    if (newWidth > 50 && newHeight > 50) {
                        element.style.top = `${startTop - (newHeight - startHeight)}px`;
                    }
                } else if (point.classList.contains('nw')) {
                    newWidth = startWidth - dx;
                    newHeight = newWidth / aspectRatio;
                    if (newWidth > 50 && newHeight > 50) {
                        element.style.left = `${startLeft + dx}px`;
                        element.style.top = `${startTop - (newHeight - startHeight)}px`;
                    }
                }

                if (newWidth > 50 && newHeight > 50) {
                    element.style.width = `${newWidth}px`;
                    element.style.height = `${newHeight}px`;
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
        let rotation = 0;

        removeBtn.addEventListener('click', () => {
            element.remove();
            objects = objects.filter(obj => obj !== element);
        });

        rotateBtn.addEventListener('click', () => {
            rotation = (rotation + 90) % 360;
            element.querySelector('.object-container').style.transform = `rotate(${rotation}deg)`;
        });
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

                // Desactivar eventos de carga
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
    backgroundPreview.addEventListener('dragleave', () => {
        backgroundPreview.classList.remove('dragover');
    });
    backgroundPreview.addEventListener('drop', handleDrop);
    backgroundInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleBackgroundImage(e.target.files[0]);
        }
    });

    loadFolders();
});