const API_KEY = '744cbe962cmshcc3c85174bb33a3p1ce46ajsna7cbfd88cfda';
// Múltiples APIs de generación de imágenes disponibles en RapidAPI
const API_CONFIGS = [
    {
        host: 'ai-image-generator3.p.rapidapi.com',
        base: 'https://ai-image-generator3.p.rapidapi.com',
        endpoint: '/generate'
    },
    {
        host: 'openai80.p.rapidapi.com',
        base: 'https://openai80.p.rapidapi.com',
        endpoint: '/images/generations'
    },
    {
        host: 'stablediffusion.p.rapidapi.com',
        base: 'https://stablediffusion.p.rapidapi.com',
        endpoint: '/text2img'
    }
];

let currentTab = 'generate';
let generatedImages = JSON.parse(localStorage.getItem('iaas_gallery') || '[]');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    setupTabSwitching();
    setupModal();
    setupEnterKeyListener();
    loadGallery();
});

// Configurar cambio de pestañas
function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');
    currentTab = tabId;
    
    if (tabId === 'gallery') {
        loadGallery();
    }
}

// Configurar modal
function setupModal() {
    const modal = document.getElementById('image-modal');
    const closeBtn = document.querySelector('.close-modal');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
        }
    });
}

// Configurar Enter en textarea
function setupEnterKeyListener() {
    const promptInput = document.getElementById('prompt-input');
    if (promptInput) {
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                generateImage();
            }
        });
    }
}

// Generar imagen
async function generateImage() {
    const prompt = document.getElementById('prompt-input').value.trim();
    if (!prompt) {
        alert('Por favor, describe la imagen que deseas crear');
        return;
    }
    
    const size = document.getElementById('image-size').value;
    const style = document.getElementById('image-style').value;
    const numImages = parseInt(document.getElementById('num-images').value);
    
    showLoading();
    disableGenerateButton();
    
    try {
        // Intentar con múltiples APIs de RapidAPI
        let success = false;
        
        for (const config of API_CONFIGS) {
            try {
                const fullPrompt = `${prompt}, ${style} style, high quality, detailed`;
                const [width, height] = size.split('x').map(Number);
                
                let url, options;
                
                // Configurar según el tipo de API
                if (config.host.includes('openai')) {
                    // OpenAI DALL-E format
                    url = config.base + config.endpoint;
                    options = {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-RapidAPI-Key': API_KEY,
                            'X-RapidAPI-Host': config.host
                        },
                        body: JSON.stringify({
                            prompt: fullPrompt,
                            n: Math.min(numImages, 4),
                            size: `${width}x${height}`
                        })
                    };
                } else if (config.host.includes('stablediffusion')) {
                    // Stable Diffusion format
                    url = config.base + config.endpoint;
                    options = {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-RapidAPI-Key': API_KEY,
                            'X-RapidAPI-Host': config.host
                        },
                        body: JSON.stringify({
                            prompt: fullPrompt,
                            width: width,
                            height: height,
                            num_inference_steps: 20,
                            guidance_scale: 7.5
                        })
                    };
                } else {
                    // Generic AI Image Generator format
                    url = config.base + config.endpoint;
                    options = {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-RapidAPI-Key': API_KEY,
                            'X-RapidAPI-Host': config.host
                        },
                        body: JSON.stringify({
                            prompt: fullPrompt,
                            width: width,
                            height: height,
                            num_images: numImages
                        })
                    };
                }
                
                console.log('🎨 Intentando con API:', config.host);
                console.log('📝 Prompt:', fullPrompt);
                
                const response = await fetch(url, options);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('✅ Respuesta recibida:', data);
                    
                    let imageUrls = [];
                    
                    // Parsear diferentes formatos de respuesta
                    if (data.data && Array.isArray(data.data)) {
                        // OpenAI format
                        imageUrls = data.data.map(item => item.url || item.b64_json);
                    } else if (data.images && Array.isArray(data.images)) {
                        imageUrls = data.images;
                    } else if (data.image || data.url || data.image_url) {
                        imageUrls = [data.image || data.url || data.image_url];
                    } else if (data.output && Array.isArray(data.output)) {
                        imageUrls = data.output;
                    }
                    
                    if (imageUrls.length > 0) {
                        // Filtrar URLs válidas
                        imageUrls = imageUrls.filter(url => url && (url.startsWith('http') || url.startsWith('data:')));
                        
                        if (imageUrls.length > 0) {
                            hideLoading();
                            enableGenerateButton();
                            displayGeneratedImages(imageUrls, prompt, size, style);
                            success = true;
                            break;
                        }
                    }
                } else {
                    console.warn(`API ${config.host} no disponible:`, response.status);
                }
            } catch (apiError) {
                console.warn(`Error con API ${config.host}:`, apiError);
                continue;
            }
        }
        
        if (!success) {
            // Si ninguna API funcionó, usar servicio gratuito alternativo
            await tryAlternativeAPI(prompt, size, style, numImages);
        }
    } catch (error) {
        console.error('Error general:', error);
        await tryAlternativeAPI(prompt, size, style, numImages);
    }
}

// Intentar con API alternativa (servicio gratuito)
async function tryAlternativeAPI(prompt, size, style, numImages) {
    try {
        console.log('🔄 Usando servicio alternativo gratuito...');
        
        // Usar Pollinations AI como alternativa gratuita y pública
        const width = size.split('x')[0];
        const height = size.split('x')[1];
        const fullPrompt = `${prompt}, ${style} style, high quality`;
        
        const imageUrls = [];
        for (let i = 0; i < numImages; i++) {
            // Pollinations AI es un servicio gratuito de generación de imágenes
            const seed = Date.now() + i;
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
            imageUrls.push(imageUrl);
        }
        
        hideLoading();
        enableGenerateButton();
        
        displayGeneratedImages(imageUrls, prompt, size, style);
        
    } catch (altError) {
        hideLoading();
        enableGenerateButton();
        console.error('Error en API alternativa:', altError);
        showNoResults('No se pudo generar la imagen en este momento. Verifica tu conexión e intenta de nuevo. Asegúrate de tener una suscripción activa en RapidAPI para las APIs premium.');
    }
}

// Mostrar imágenes generadas
function displayGeneratedImages(imageUrls, prompt, size, style) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';
    
    imageUrls.forEach((imageUrl, index) => {
        const card = createImageCard(imageUrl, prompt, size, style, index);
        resultsDiv.appendChild(card);
        
        // Guardar en galería
        saveToGallery(imageUrl, prompt, size, style);
    });
    
    // Cambiar a pestaña de resultados si estamos en generar
    if (currentTab === 'generate') {
        // Los resultados se muestran debajo
    }
}

// Crear tarjeta de imagen
function createImageCard(imageUrl, prompt, size, style, index) {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.addEventListener('click', () => showImageModal(imageUrl, prompt, size, style));
    
    const img = document.createElement('img');
    img.className = 'generated-image';
    img.src = imageUrl;
    img.alt = prompt;
    img.loading = 'lazy';
    img.onerror = function() {
        this.src = 'https://via.placeholder.com/400x400?text=Error+al+cargar+imagen';
    };
    
    const info = document.createElement('div');
    info.className = 'image-info';
    
    const promptText = document.createElement('p');
    promptText.className = 'image-prompt';
    promptText.textContent = prompt;
    
    const meta = document.createElement('div');
    meta.className = 'image-meta';
    
    const sizeText = document.createElement('span');
    sizeText.textContent = `${size} • ${style}`;
    
    const downloadBtn = document.createElement('a');
    downloadBtn.href = imageUrl;
    downloadBtn.download = `iaas-image-${Date.now()}-${index}.png`;
    downloadBtn.className = 'download-btn';
    downloadBtn.textContent = '⬇️ Descargar';
    downloadBtn.onclick = (e) => {
        e.stopPropagation();
        // Forzar descarga
        fetch(imageUrl)
            .then(res => res.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `iaas-image-${Date.now()}-${index}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            });
    };
    
    meta.appendChild(sizeText);
    meta.appendChild(downloadBtn);
    
    info.appendChild(promptText);
    info.appendChild(meta);
    
    card.appendChild(img);
    card.appendChild(info);
    
    return card;
}

// Mostrar modal de imagen
function showImageModal(imageUrl, prompt, size, style) {
    const modal = document.getElementById('image-modal');
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = '';
    
    const img = document.createElement('img');
    img.className = 'modal-image';
    img.src = imageUrl;
    img.alt = prompt;
    
    const promptDiv = document.createElement('div');
    promptDiv.className = 'modal-prompt';
    promptDiv.innerHTML = `<strong>Descripción:</strong><br>${prompt}<br><br><strong>Tamaño:</strong> ${size} | <strong>Estilo:</strong> ${style}`;
    
    modalBody.appendChild(img);
    modalBody.appendChild(promptDiv);
    
    modal.classList.remove('hidden');
}

// Guardar en galería
function saveToGallery(imageUrl, prompt, size, style) {
    const imageData = {
        url: imageUrl,
        prompt: prompt,
        size: size,
        style: style,
        date: new Date().toISOString()
    };
    
    generatedImages.unshift(imageData);
    
    // Mantener solo las últimas 50 imágenes
    if (generatedImages.length > 50) {
        generatedImages = generatedImages.slice(0, 50);
    }
    
    localStorage.setItem('iaas_gallery', JSON.stringify(generatedImages));
}

// Cargar galería
function loadGallery() {
    const galleryGrid = document.getElementById('gallery-grid');
    if (!galleryGrid) return;
    
    galleryGrid.innerHTML = '';
    
    if (generatedImages.length === 0) {
        galleryGrid.innerHTML = '<div class="no-results">No hay imágenes en tu galería aún. Genera algunas imágenes para verlas aquí.</div>';
        return;
    }
    
    generatedImages.forEach((imageData, index) => {
        const card = createImageCard(imageData.url, imageData.prompt, imageData.size, imageData.style, index);
        galleryGrid.appendChild(card);
    });
}

// Limpiar galería
function clearGallery() {
    if (confirm('¿Estás seguro de que deseas limpiar toda la galería?')) {
        generatedImages = [];
        localStorage.removeItem('iaas_gallery');
        loadGallery();
    }
}

// Mostrar loading
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('results').innerHTML = '';
}

// Ocultar loading
function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

// Deshabilitar botón de generar
function disableGenerateButton() {
    const btn = document.querySelector('.generate-btn');
    btn.disabled = true;
    document.querySelector('.btn-text').classList.add('hidden');
    document.querySelector('.btn-loader').classList.remove('hidden');
}

// Habilitar botón de generar
function enableGenerateButton() {
    const btn = document.querySelector('.generate-btn');
    btn.disabled = false;
    document.querySelector('.btn-text').classList.remove('hidden');
    document.querySelector('.btn-loader').classList.add('hidden');
}

// Mostrar sin resultados
function showNoResults(message) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<div class="no-results">${message}</div>`;
}

