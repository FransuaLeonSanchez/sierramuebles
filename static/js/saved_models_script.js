document.addEventListener('DOMContentLoaded', function() {
    const savedModelsGrid = document.getElementById('savedModelsGrid');

    async function loadSavedModels() {
        try {
            const response = await fetch('/get_saved_models');
            const data = await response.json();

            if (data.models) {
                savedModelsGrid.innerHTML = data.models
                    .map(model => `
                        <div class="saved-model-item">
                            <img src="${model.url}" alt="Modelo guardado">
                            <div class="download-overlay">
                                <a href="${model.url}" download="${model.filename}">Descargar</a>
                            </div>
                        </div>
                    `)
                    .join('');
            }
        } catch (error) {
            console.error('Error cargando modelos guardados:', error);
        }
    }

    loadSavedModels();
});