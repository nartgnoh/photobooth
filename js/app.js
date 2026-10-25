const EVENT_TEXT_STORAGE_KEY = 'photobooth-event-text-v1';
const BOOTH_SETTINGS_DATABASE = 'photobooth-settings';
const BOOTH_SETTINGS_STORE = 'settings';
const BOOTH_SETTINGS_KEY = 'current';
const BOOTH_GALLERY_STORE = 'recent-gallery';
const BOOTH_GALLERY_KEY = 'photos';
const COUNTDOWN_TICK_MS = 1200;
const READY_PROMPT_MS = COUNTDOWN_TICK_MS;
const CAPTURED_PHOTO_PREVIEW_MS = 1000;
const PRINT_CONTENT_SCALE = 0.96;

const EVENT_FONT_OPTIONS = [
    { value: 'Alex Brush', label: 'Alex Brush' },
    { value: 'Cinzel', label: 'Cinzel' },
    { value: 'Cooper Black', label: 'Cooper Black' },
    { value: 'Courier New', label: 'Courier New' },
    { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Montserrat', label: 'Montserrat' },
    { value: 'New Century Schoolbook', label: 'New Century Schoolbook' },
    { value: 'Optima', label: 'Optima' },
    { value: 'Playfair Display', label: 'Playfair Display' },
    { value: 'Times New Roman', label: 'Times New Roman' }
];

let boothSettingsDatabasePromise = null;
let boothSettingsSaveTimeout = null;

const state = {

            currentScreen: 'mode',

            selectedTemplate: 'single',

            overlayTheme: 'gold',

            printBackground: 'theme',

            customPrintBackgroundImage: null,

            customPrintBackgroundName: '',

            customThemeColors: {
                background: '#FDFBF7',
                accent: '#D4AF37',
                text: '#2C2A29'
            },

            borderStyle: 'classic',

            capturedImages: [],

            eventData: {

                title: "DENNIS & HONG'S WEDDING",
                date: "2028-05-20",
                subtitle: "Thank you for joining us!",
                fonts: {
                    title: 'Playfair Display',
                    date: 'Cinzel',
                    subtitle: 'Montserrat'
                },

                countdownSeconds: 3,

                resetSeconds: 60

            },

            webcamStream: null,

            cameraStartPromise: null,

            captureInProgress: false,

            captureCancelled: false,

            countdownTimeout: null,

            countdownResolve: null,

            captureDelayTimeout: null,

            captureDelayResolve: null,

            selectedCameraId: '',

            audioContext: null,

            eventLogoDataUrl: '',

            recentGallery: [],

            galleryStorageError: '',

            autoResetTimer: null,

            resetCountdownRemaining: 60,

            autoResetPauseReasons: new Set()

        };

        const DOM = {

            main: document.querySelector('main'),

            screens: {

                mode: document.getElementById('screen-mode'),

                capture: document.getElementById('screen-capture'),

                review: document.getElementById('screen-review')

            },

            video: document.getElementById('webcam'),

            cameraSelect: document.getElementById('cfg-camera'),

            cameraStatus: document.getElementById('camera-status'),

            logoInput: document.getElementById('cfg-logo'),

            logoPreview: document.getElementById('logo-preview'),

            logoPreviewContainer: document.getElementById('logo-preview-container'),

            logoStatus: document.getElementById('logo-status'),

            canvas: document.getElementById('output-canvas'),

            capturePreview: document.querySelector('.capture-preview-frame'),

            captureControls: document.querySelector('.capture-controls'),

            capturedPhotoPreview: document.getElementById('captured-photo-preview'),

            printBackgroundImage: document.getElementById('water-lilies-background-image'),

            printBackgroundFileInput: document.getElementById('cfg-print-background-file'),

            countdownOverlay: document.getElementById('countdown-overlay'),

            countdownNumber: document.getElementById('countdown-number'),

            sequenceIndicator: document.getElementById('sequence-indicator'),

            flashOverlay: document.getElementById('flash-overlay'),

            headerTitle: document.getElementById('header-title'),

            headerDate: document.getElementById('header-date'),

            qrModal: document.getElementById('qr-modal'),

            galleryModal: document.getElementById('gallery-modal'),

            adminDrawer: document.getElementById('admin-drawer')

        };

        window.addEventListener('DOMContentLoaded', async () => {

            lucide.createIcons();

            await loadPersistentBoothSettings();
            await loadRecentGallery();
            document.getElementById('cfg-title').value = state.eventData.title;
            syncEventDateInputs();
            document.getElementById('cfg-subtitle').value = state.eventData.subtitle;
            syncEventFontInputs();
            initializePrintBackground();
            applyAppTheme(getOverlayThemeColors());
            PhotoBoothBorders.renderOptions('review-border-options', 'guest');
            PhotoBoothBorders.renderOptions('settings-border-options', 'settings');
            syncBorderStyleOptions();
            updateHeaderDisplay();
            window.addEventListener('resize', updateCapturePreviewSize);
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', updateCapturePreviewSize);
            }

        });

        function openBoothSettingsDatabase() {
            if (boothSettingsDatabasePromise) return boothSettingsDatabasePromise;

            boothSettingsDatabasePromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(BOOTH_SETTINGS_DATABASE, 2);
                request.onupgradeneeded = () => {
                    const database = request.result;
                    if (!database.objectStoreNames.contains(BOOTH_SETTINGS_STORE)) {
                        database.createObjectStore(BOOTH_SETTINGS_STORE);
                    }
                    if (!database.objectStoreNames.contains(BOOTH_GALLERY_STORE)) {
                        database.createObjectStore(BOOTH_GALLERY_STORE);
                    }
                };
                request.onsuccess = () => {
                    const database = request.result;
                    database.onversionchange = () => database.close();
                    resolve(database);
                };
                request.onerror = () => reject(request.error || new Error('Unable to open booth settings storage.'));
                request.onblocked = () => reject(new Error('Booth settings storage is blocked by another open page.'));
            }).catch(error => {
                boothSettingsDatabasePromise = null;
                throw error;
            });

            return boothSettingsDatabasePromise;
        }

        function readBoothSettings(database) {
            return new Promise((resolve, reject) => {
                const transaction = database.transaction(BOOTH_SETTINGS_STORE, 'readonly');
                const request = transaction.objectStore(BOOTH_SETTINGS_STORE).get(BOOTH_SETTINGS_KEY);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error || new Error('Unable to read saved booth settings.'));
                transaction.onabort = () => reject(transaction.error || new Error('Reading booth settings was interrupted.'));
            });
        }

        function writeBoothSettings(database, settings) {
            return new Promise((resolve, reject) => {
                const transaction = database.transaction(BOOTH_SETTINGS_STORE, 'readwrite');
                transaction.objectStore(BOOTH_SETTINGS_STORE).put(settings, BOOTH_SETTINGS_KEY);
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error || new Error('Unable to save booth settings.'));
                transaction.onabort = () => reject(transaction.error || new Error('Saving booth settings was interrupted.'));
            });
        }

        async function loadPersistentBoothSettings() {
            try {
                const database = await openBoothSettingsDatabase();
                const savedSettings = await readBoothSettings(database);
                if (savedSettings) {
                    await applyPersistentBoothSettings(savedSettings);
                    return;
                }

                const legacyText = localStorage.getItem(EVENT_TEXT_STORAGE_KEY);
                if (!legacyText) return;
                const eventText = JSON.parse(legacyText);
                if (!eventText || typeof eventText !== 'object' ||
                    typeof eventText.title !== 'string' ||
                    typeof eventText.date !== 'string' ||
                    typeof eventText.subtitle !== 'string') {
                    throw new Error('Saved event text has an invalid format.');
                }

                state.eventData.title = eventText.title;
                state.eventData.date = toCalendarDate(eventText.date) || '';
                state.eventData.subtitle = eventText.subtitle;
                if (eventText.fonts && typeof eventText.fonts === 'object') {
                    state.eventData.fonts = {
                        title: getSavedFont(eventText.fonts.title, 'Playfair Display'),
                        date: getSavedFont(eventText.fonts.date, 'Cinzel'),
                        subtitle: getSavedFont(eventText.fonts.subtitle, 'Montserrat')
                    };
                }
                await savePersistentBoothSettings();
            } catch (error) {
                console.error('Unable to load saved booth settings.', error);
                document.getElementById('settings-status').textContent =
                    'Could not load saved booth settings from this device.';
            }
        }

        async function applyPersistentBoothSettings(settings) {
            if (!settings || typeof settings !== 'object') {
                throw new Error('Saved booth settings have an invalid format.');
            }

            if (typeof settings.title === 'string') state.eventData.title = settings.title;
            if (typeof settings.date === 'string') state.eventData.date = toCalendarDate(settings.date) || '';
            if (typeof settings.subtitle === 'string') state.eventData.subtitle = settings.subtitle;
            if (settings.fonts && typeof settings.fonts === 'object') {
                state.eventData.fonts = {
                    title: getSavedFont(settings.fonts.title, 'Playfair Display'),
                    date: getSavedFont(settings.fonts.date, 'Cinzel'),
                    subtitle: getSavedFont(settings.fonts.subtitle, 'Montserrat')
                };
            }
            if ([3, 5, 10].includes(Number(settings.countdownSeconds))) {
                state.eventData.countdownSeconds = Number(settings.countdownSeconds);
            }
            if ([30, 60, 90].includes(Number(settings.resetSeconds))) {
                state.eventData.resetSeconds = Number(settings.resetSeconds);
            }
            if (typeof settings.selectedCameraId === 'string') {
                state.selectedCameraId = settings.selectedCameraId;
            }

            const themes = ['gold', 'sage', 'minimal', 'rose', 'ocean', 'lavender', 'terracotta', 'midnight', 'custom'];
            if (themes.includes(settings.overlayTheme)) state.overlayTheme = settings.overlayTheme;
            if (settings.customThemeColors && ['background', 'accent', 'text'].every(color =>
                /^#[0-9a-f]{6}$/i.test(settings.customThemeColors[color])
            )) {
                state.customThemeColors = { ...settings.customThemeColors };
            } else if (state.overlayTheme !== 'custom') {
                state.customThemeColors = { ...getOverlayThemeColors(state.overlayTheme) };
            }
            if (PhotoBoothBorders.hasStyle(settings.borderStyle)) state.borderStyle = settings.borderStyle;
            if (['theme', 'water-lilies', 'custom'].includes(settings.printBackground)) {
                state.printBackground = settings.printBackground;
            }

            state.eventLogoDataUrl = typeof settings.eventLogoDataUrl === 'string' ? settings.eventLogoDataUrl : '';
            if (typeof settings.customPrintBackgroundDataUrl === 'string' && settings.customPrintBackgroundDataUrl) {
                try {
                    state.customPrintBackgroundImage = await loadImage(settings.customPrintBackgroundDataUrl);
                    state.customPrintBackgroundName = typeof settings.customPrintBackgroundName === 'string'
                        ? settings.customPrintBackgroundName
                        : 'Custom background';
                } catch (error) {
                    console.error('Unable to restore the saved print background image.', error);
                    state.customPrintBackgroundImage = null;
                    state.customPrintBackgroundName = '';
                    state.printBackground = 'theme';
                }
            }

            if (state.printBackground === 'custom' && !state.customPrintBackgroundImage) {
                state.printBackground = 'theme';
            }

            if (state.eventLogoDataUrl) {
                try {
                    await loadImage(state.eventLogoDataUrl);
                } catch (error) {
                    console.error('Unable to restore the saved event logo.', error);
                    state.eventLogoDataUrl = '';
                }
            }

            document.getElementById('cfg-title').value = state.eventData.title;
            document.getElementById('cfg-subtitle').value = state.eventData.subtitle;
            document.getElementById('cfg-countdown').value = String(state.eventData.countdownSeconds);
            document.getElementById('cfg-reset').value = String(state.eventData.resetSeconds);
            document.getElementById('cfg-camera').value = state.selectedCameraId;
            document.getElementById('custom-bg-color').value = state.customThemeColors.background;
            document.getElementById('custom-accent-color').value = state.customThemeColors.accent;
            document.getElementById('custom-text-color').value = state.customThemeColors.text;
            syncEventFontInputs();
            syncEventDateInputs();
            updateLogoPreview();
            document.getElementById('custom-print-background-preview').src =
                state.customPrintBackgroundImage ? state.customPrintBackgroundImage.src : '';
            document.getElementById('custom-print-background-preview').classList.toggle('hidden', !state.customPrintBackgroundImage);
            document.getElementById('custom-print-background-placeholder').classList.toggle('hidden', Boolean(state.customPrintBackgroundImage));
            document.getElementById('custom-print-background-name').textContent = state.customPrintBackgroundName;
            document.getElementById('custom-print-background-remove').classList.toggle('hidden', !state.customPrintBackgroundImage);
            syncPrintBackgroundOptions();
            applyAppTheme(getOverlayThemeColors());
            syncBorderStyleOptions();
            updateHeaderDisplay();
        }

        function loadImage(source) {
            return new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error('The saved image could not be loaded.'));
                image.src = source;
            });
        }

        function getPersistentBoothSettings() {
            return {
                title: state.eventData.title,
                date: state.eventData.date,
                subtitle: state.eventData.subtitle,
                fonts: { ...state.eventData.fonts },
                countdownSeconds: state.eventData.countdownSeconds,
                resetSeconds: state.eventData.resetSeconds,
                selectedCameraId: state.selectedCameraId,
                overlayTheme: state.overlayTheme,
                customThemeColors: { ...state.customThemeColors },
                borderStyle: state.borderStyle,
                printBackground: state.printBackground,
                eventLogoDataUrl: state.eventLogoDataUrl,
                customPrintBackgroundDataUrl: state.customPrintBackgroundImage
                    ? state.customPrintBackgroundImage.src
                    : '',
                customPrintBackgroundName: state.customPrintBackgroundName
            };
        }

        async function savePersistentBoothSettings() {
            try {
                const database = await openBoothSettingsDatabase();
                await writeBoothSettings(database, getPersistentBoothSettings());
                localStorage.removeItem(EVENT_TEXT_STORAGE_KEY);
                document.getElementById('settings-status').textContent =
                    'Booth settings saved on this device and will remain after a refresh.';
                return true;
            } catch (error) {
                console.error('Unable to save booth settings on this device.', error);
                document.getElementById('settings-status').textContent =
                    'Settings could not be saved in this browser. Check available device storage.';
                return false;
            }
        }

        function schedulePersistentBoothSettingsSave() {
            clearTimeout(boothSettingsSaveTimeout);
            boothSettingsSaveTimeout = setTimeout(() => {
                savePersistentBoothSettings();
            }, 300);
        }

        function updateHeaderDisplay() {

            DOM.headerTitle.textContent = state.eventData.title;
            DOM.headerTitle.style.fontFamily = `'${state.eventData.fonts.title}', serif`;
            DOM.headerDate.textContent = formatEventDate(state.eventData.date);
            DOM.headerDate.style.fontFamily = `'${state.eventData.fonts.date}', serif`;
            DOM.headerDate.classList.toggle('hidden', !state.eventData.date);

        }

        function showResetBoothConfigurationDialog() {
            const modal = document.getElementById('reset-config-modal');
            modal.classList.remove('hidden');
            modal.querySelector('button').focus();
            document.addEventListener('keydown', handleResetDialogKeydown);
        }

        function closeResetBoothConfigurationDialog() {
            const modal = document.getElementById('reset-config-modal');
            if (modal.classList.contains('hidden')) return;

            modal.classList.add('hidden');
            document.removeEventListener('keydown', handleResetDialogKeydown);
            document.getElementById('reset-config-button').focus();
        }

        function handleResetDialogKeydown(event) {
            if (event.key === 'Escape') {
                closeResetBoothConfigurationDialog();
            }
        }

        function switchScreen(screenName) {

            state.currentScreen = screenName;
            DOM.main.classList.toggle('review-screen-active', screenName === 'review');
            DOM.main.classList.toggle('capture-screen-active', screenName === 'capture');

            Object.keys(DOM.screens).forEach(key => {

                if (key === screenName) {

                    DOM.screens[key].classList.remove('hidden');

                    DOM.screens[key].classList.add('flex');

                } else {

                    DOM.screens[key].classList.add('hidden');

                    DOM.screens[key].classList.remove('flex');

                }

            });

            if (screenName === 'review') {
                syncBorderStyleOptions();
            }

            if (screenName !== 'review') {

                clearInterval(state.autoResetTimer);
                state.autoResetTimer = null;
                state.autoResetPauseReasons.clear();

            }

            if (screenName === 'capture') {
                updateCapturePreviewSize();
            }

        }

        function updateCapturePreviewSize() {
            if (state.currentScreen !== 'capture') return;

            const section = DOM.screens.capture;
            const availableHeight = section.clientHeight -
                DOM.captureControls.offsetHeight -
                (parseFloat(getComputedStyle(section).rowGap) || 0);
            const width = Math.max(0, Math.min(section.clientWidth, 672, availableHeight * 4 / 3));

            DOM.capturePreview.style.width = `${width}px`;
            DOM.capturePreview.style.height = `${width * 3 / 4}px`;
        }

        async function selectTemplate(templateType) {
            state.selectedTemplate = templateType;
            const cameraReady = await startWebcam();
            if (!cameraReady) return;
            switchScreen('capture');
        }

        async function startWebcam() {
            if (state.cameraStartPromise) {
                return state.cameraStartPromise;
            }

            const startPromise = (async () => {
                try {
                    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                        throw new Error("Camera access requires a supported browser and a secure connection (HTTPS or localhost).");
                    }

                    const videoConstraints = {
                        ...(state.selectedCameraId
                            ? { deviceId: { exact: state.selectedCameraId } }
                            : { facingMode: "user" }),
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    };
                    const constraints = {
                        video: videoConstraints,
                        audio: false
                    };
                    state.webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
                    DOM.video.muted = true;
                    DOM.video.playsInline = true;
                    DOM.video.srcObject = state.webcamStream;
                    await DOM.video.play();
                    return true;
                } catch (err) {
                    stopWebcam();
                    const errorName = err instanceof DOMException ? err.name : '';
                    const message = errorName === 'AbortError'
                        ? "The browser interrupted camera startup. Close other tabs or apps using the camera, then reload the page and try again."
                        : errorName === 'NotAllowedError' || errorName === 'SecurityError'
                            ? "Allow camera access for this website in iPad Settings, then reload the page."
                            : errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError'
                                ? "No camera was found. Check that a camera is available and try again."
                                : `Please allow camera access and use HTTPS or localhost.\n\n${err.message}`;
                    alert(`Unable to start the camera. ${message}`);
                    console.error("Webcam error:", err);
                    return false;
                }
            })();

            state.cameraStartPromise = startPromise;
            try {
                return await startPromise;
            } finally {
                if (state.cameraStartPromise === startPromise) {
                    state.cameraStartPromise = null;
                }
            }
        }

        async function refreshCameraList() {
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error("Camera selection requires a supported browser and a secure connection (HTTPS or localhost).");
                }

                DOM.cameraStatus.textContent = "Requesting camera access…";
                const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                permissionStream.getTracks().forEach(track => track.stop());

                const devices = await navigator.mediaDevices.enumerateDevices();
                const cameras = devices.filter(device => device.kind === 'videoinput');
                const previousSelection = DOM.cameraSelect.value || state.selectedCameraId;

                DOM.cameraSelect.replaceChildren(new Option("Default camera", ""));

                cameras.forEach((camera, index) => {
                    const label = camera.label || `Camera ${index + 1}`;
                    DOM.cameraSelect.add(new Option(label, camera.deviceId));
                });

                if (cameras.some(camera => camera.deviceId === previousSelection)) {
                    DOM.cameraSelect.value = previousSelection;
                } else {
                    DOM.cameraSelect.value = "";
                    if (previousSelection) {
                        state.selectedCameraId = "";
                    }
                }

                DOM.cameraStatus.textContent = cameras.length
                    ? `${cameras.length} camera${cameras.length === 1 ? '' : 's'} found. Select one and save settings.`
                    : "No cameras found. Connect a camera and search again.";
            } catch (err) {
                DOM.cameraStatus.textContent = `Could not find cameras: ${err.message}`;
                console.error("Camera discovery error:", err);
            }
        }

        function stopWebcam() {

            if (state.webcamStream) {

                state.webcamStream.getTracks().forEach(track => track.stop());

                state.webcamStream = null;

            }

            DOM.video.srcObject = null;

        }

        function playBeepSound(frequency = 800, duration = 0.1) {

            const ctx = state.audioContext;
            if (!ctx || ctx.state !== 'running') return;

            const osc = ctx.createOscillator();

            const gain = ctx.createGain();

            osc.type = 'sine';

            osc.frequency.value = frequency;

            gain.gain.setValueAtTime(0.2, ctx.currentTime);

            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

            osc.connect(gain);

            gain.connect(ctx.destination);

            osc.start();

            osc.stop(ctx.currentTime + duration);

        }

        async function unlockAudio() {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;

            if (!state.audioContext ||
                state.audioContext.state === 'closed' ||
                state.audioContext.state === 'interrupted') {
                state.audioContext = new AudioContextClass();
            }

            if (state.audioContext.state !== 'running') {
                try {
                    await state.audioContext.resume();
                } catch (error) {
                    const interruptedContext = state.audioContext;
                    state.audioContext = new AudioContextClass();
                    try {
                        await state.audioContext.resume();
                    } catch (retryError) {
                        state.audioContext = interruptedContext;
                        throw retryError;
                    }
                }
            }

            if (state.audioContext.state !== 'running') {
                throw new Error(`Audio context did not start (state: ${state.audioContext.state}).`);
            }

        }

        function playShutterSound() {

            const ctx = state.audioContext;
            if (!ctx || ctx.state !== 'running') return;

            const now = ctx.currentTime;
            const noiseDuration = 0.018;
            const noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * noiseDuration), ctx.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseData.length; i++) {
                noiseData[i] = Math.random() * 2 - 1;
            }

            const playClick = (time, frequency, peakGain) => {
                const click = ctx.createBufferSource();
                const filter = ctx.createBiquadFilter();
                const clickGain = ctx.createGain();

                click.buffer = noiseBuffer;
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(frequency, time);
                filter.Q.setValueAtTime(0.9, time);
                clickGain.gain.setValueAtTime(peakGain, time);
                clickGain.gain.exponentialRampToValueAtTime(0.001, time + noiseDuration);
                click.connect(filter);
                filter.connect(clickGain);
                clickGain.connect(ctx.destination);
                click.start(time);
                click.stop(time + noiseDuration);
            };

            playClick(now, 2100, 0.24);
            playClick(now + 0.025, 820, 0.18);
            playClick(now + 0.055, 2600, 0.08);

        }

        async function startCaptureSequence() {

            if (state.captureInProgress) return;

            state.captureInProgress = true;
            state.captureCancelled = false;

            try {
                await unlockAudio();
            } catch (error) {
                console.error('Could not enable capture sounds:', error);
            }

            if (state.captureCancelled) return;

            state.capturedImages = [];

            document.getElementById('shutter-btn').style.display = 'none';

            let photoCount = 1;

            if (state.selectedTemplate === 'strip2') photoCount = 4;

            if (state.selectedTemplate === 'grid4') photoCount = 4;
            if (state.selectedTemplate === 'portrait4') photoCount = 4;

            for (let i = 0; i < photoCount; i++) {

                if (state.captureCancelled) return;

                DOM.sequenceIndicator.textContent = `Photo ${i + 1} of ${photoCount}`;

                await runReadyPrompt();

                if (state.captureCancelled) return;

                await runCountdown(state.eventData.countdownSeconds);

                if (state.captureCancelled) return;

                triggerFlash();

                playShutterSound();

                const snapshot = captureWebcamFrame();

                state.capturedImages.push(snapshot);

                if (photoCount > 1) {
                    await showCapturedPhotoPreview(snapshot);
                    if (state.captureCancelled) return;
                }

            }

            state.captureInProgress = false;
            document.getElementById('shutter-btn').style.display = 'flex';

            stopWebcam();

            renderFinalCanvas(true);

            switchScreen('review');

            startAutoResetTimer();

            confetti({

                particleCount: 70,

                spread: 60,

                origin: { y: 0.6 },

                colors: ['#D4AF37', '#E6D7C3', '#82A479']

            });

        }

        function runCountdown(seconds) {

            return new Promise((resolve) => {

                const startTime = performance.now();
                let count = seconds;

                DOM.countdownNumber.classList.remove('animate-ping');
                DOM.countdownNumber.classList.remove('text-6xl');
                DOM.countdownNumber.classList.add('text-9xl');
                DOM.countdownOverlay.classList.remove('hidden');

                DOM.countdownNumber.textContent = count;

                playBeepSound(600, 0.1);

                state.countdownResolve = resolve;
                const tick = () => {
                    const elapsedTicks = Math.floor((performance.now() - startTime) / COUNTDOWN_TICK_MS);
                    const nextCount = seconds - elapsedTicks;

                    if (nextCount <= 0) {
                        state.countdownTimeout = null;
                        state.countdownResolve = null;
                        DOM.countdownOverlay.classList.add('hidden');
                        resolve();
                        return;
                    }

                    if (nextCount < count) {
                        count = nextCount;
                        DOM.countdownNumber.textContent = count;
                        playBeepSound(600, 0.1);
                    }

                    const nextTickAt = startTime + (seconds - count + 1) * COUNTDOWN_TICK_MS;
                    state.countdownTimeout = setTimeout(tick, Math.max(0, nextTickAt - performance.now()));
                };

                const firstTickAt = startTime + COUNTDOWN_TICK_MS;
                state.countdownTimeout = setTimeout(tick, Math.max(0, firstTickAt - performance.now()));

            });

        }

        function runReadyPrompt() {
            return new Promise(resolve => {
                DOM.countdownNumber.classList.remove('animate-ping', 'text-9xl');
                DOM.countdownNumber.classList.add('text-6xl');
                DOM.countdownNumber.textContent = 'Ready?';
                DOM.countdownOverlay.classList.remove('hidden');
                state.captureDelayResolve = resolve;
                state.captureDelayTimeout = setTimeout(() => {
                    state.captureDelayTimeout = null;
                    state.captureDelayResolve = null;
                    DOM.countdownOverlay.classList.add('hidden');
                    DOM.countdownNumber.classList.add('animate-ping');
                    resolve();
                }, READY_PROMPT_MS);
            });
        }

        async function showCapturedPhotoPreview(imageData) {
            DOM.capturedPhotoPreview.src = imageData;
            DOM.video.pause();
            DOM.capturedPhotoPreview.classList.remove('hidden');

            await new Promise(resolve => {
                state.captureDelayResolve = resolve;
                state.captureDelayTimeout = setTimeout(() => {
                    state.captureDelayTimeout = null;
                    state.captureDelayResolve = null;
                    resolve();
                }, CAPTURED_PHOTO_PREVIEW_MS);
            });

            DOM.capturedPhotoPreview.classList.add('hidden');
            DOM.capturedPhotoPreview.removeAttribute('src');
            if (state.captureCancelled || !DOM.video.srcObject) return;

            try {
                await DOM.video.play();
            } catch (error) {
                DOM.cameraStatus.textContent = 'The live camera preview could not resume. Please reload the booth before capturing again.';
                console.error('Unable to resume the live camera preview after showing the captured photo.', error);
            }
        }

        function triggerFlash() {

            DOM.flashOverlay.classList.add('active');

            setTimeout(() => {

                DOM.flashOverlay.classList.remove('active');

            }, 150);

        }

        function captureWebcamFrame() {

            const tempCanvas = document.createElement('canvas');

            tempCanvas.width = DOM.video.videoWidth || 1280;

            tempCanvas.height = DOM.video.videoHeight || 720;

            const ctx = tempCanvas.getContext('2d');

            ctx.translate(tempCanvas.width, 0);

            ctx.scale(-1, 1);

            ctx.drawImage(DOM.video, 0, 0, tempCanvas.width, tempCanvas.height);

            return tempCanvas.toDataURL('image/jpeg', 0.92);

        }

        function cancelCapture() {

            state.captureCancelled = true;
            state.captureInProgress = false;

            if (state.countdownTimeout !== null) {
                clearTimeout(state.countdownTimeout);
                state.countdownTimeout = null;
            }
            if (state.countdownResolve) {
                state.countdownResolve();
                state.countdownResolve = null;
            }
            if (state.captureDelayTimeout !== null) {
                clearTimeout(state.captureDelayTimeout);
                state.captureDelayTimeout = null;
            }
            if (state.captureDelayResolve) {
                state.captureDelayResolve();
                state.captureDelayResolve = null;
            }
            DOM.capturedPhotoPreview.classList.add('hidden');
            DOM.capturedPhotoPreview.removeAttribute('src');
            DOM.countdownOverlay.classList.add('hidden');

            stopWebcam();

            document.getElementById('shutter-btn').style.display = 'flex';

            switchScreen('mode');

        }

        function renderFinalCanvas(addToGallery = false) {

            const canvas = DOM.canvas;

            const ctx = canvas.getContext('2d');

            const isPortraitPrint = state.selectedTemplate === 'strip2' || state.selectedTemplate === 'portrait4';
            const W = isPortraitPrint ? 1200 : 1800;
            const H = isPortraitPrint ? 1800 : 1200;
            const borderStyle = state.borderStyle;

            canvas.width = W;

            canvas.height = H;

            const themeColors = getOverlayThemeColors();
            const bgColor = themeColors.background;
            const fontColor = themeColors.text;
            const accentColor = themeColors.accent;

            ctx.fillStyle = bgColor;

            ctx.fillRect(0, 0, W, H);

            if (state.printBackground === 'water-lilies' || state.printBackground === 'custom') {
                ctx.save();
                ctx.globalAlpha = 0.86;
                const backgroundImage = state.printBackground === 'custom'
                    ? state.customPrintBackgroundImage
                    : DOM.printBackgroundImage;
                drawCroppedImage(ctx, backgroundImage, 0, 0, W, H);
                ctx.restore();
            }

            const loadedImages = [];
            let loadedCount = 0;

            const drawCanvas = (logoImage = null) => {
                const contentWidth = W * PRINT_CONTENT_SCALE;
                const contentHeight = H * PRINT_CONTENT_SCALE;

                ctx.save();
                ctx.translate((W - contentWidth) / 2, (H - contentHeight) / 2);
                ctx.scale(PRINT_CONTENT_SCALE, PRINT_CONTENT_SCALE);
                drawPhotosAndOverlay(ctx, W, H, loadedImages, fontColor, accentColor, bgColor, logoImage, borderStyle);
                if (state.selectedTemplate !== 'strip2') {
                    PhotoBoothBorders.drawDecorativeFrame(ctx, 30, 30, W - 60, H - 60, accentColor, borderStyle);
                }
                ctx.restore();
                if (addToGallery) {
                    saveToRecentGallery(canvas.toDataURL('image/jpeg', 0.92));
                }
            };

            state.capturedImages.forEach((src, idx) => {

                const img = new Image();

                img.onload = () => {

                    loadedImages[idx] = img;
                    loadedCount++;
                    if (loadedCount === state.capturedImages.length) {
                        if (!state.eventLogoDataUrl) {
                            drawCanvas();
                            return;
                        }

                        const logoImage = new Image();
                        logoImage.onload = () => drawCanvas(logoImage);
                        logoImage.onerror = () => {
                            DOM.logoStatus.textContent = "The uploaded logo could not be loaded. Try another image.";
                            console.error("Unable to load the uploaded event logo.");
                            drawCanvas();
                        };
                        logoImage.src = state.eventLogoDataUrl;
                    }

                };

                img.src = src;

            });

        }

        function drawPhotosAndOverlay(ctx, W, H, images, fontColor, accentColor, bgColor, logoImage = null, borderStyle = state.borderStyle) {
            const template = state.selectedTemplate;
            if (template === 'single') {
                drawPhotoFrame(ctx, images[0], 220, 85, 1360, 765, accentColor, 7);
                drawSingleEventCaption(ctx, fontColor, accentColor, W);
                return;
            }

            if (template === 'strip2') {

                const stripWidth = 480;
                const stripSideInset = 24;
                const stripPositions = [45 + stripSideInset, 675 - stripSideInset];

                const photoXInset = 26;

                const photoWidth = stripWidth - (photoXInset * 2);

                const photoHeight = 310;
                const photoGap = 16;
                const photoTop = 95;

                stripPositions.forEach(stripX => {

                    images.forEach((img, index) => {

                        const photoY = photoTop + index * (photoHeight + photoGap);

                        drawCroppedImage(ctx, img, stripX + photoXInset, photoY, photoWidth, photoHeight);

                        ctx.strokeStyle = accentColor;

                        ctx.lineWidth = 4;

                        ctx.strokeRect(stripX + photoXInset, photoY, photoWidth, photoHeight);

                    });

                    PhotoBoothBorders.drawDecorativeFrame(ctx, stripX, 55, stripWidth, H - 110, accentColor, borderStyle);

                    const stripCenterX = stripX + stripWidth / 2;
                    if (logoImage) {
                        drawLogoImage(ctx, logoImage, stripCenterX, H - 405, 110, 50);
                    }
                    drawStripEventCaption(ctx, stripX, stripWidth, H, fontColor, accentColor, bgColor);

                });

                ctx.save();

                ctx.setLineDash([14, 12]);

                ctx.strokeStyle = accentColor;

                ctx.lineWidth = 3;

                ctx.beginPath();

                ctx.moveTo(W / 2, 45);

                ctx.lineTo(W / 2, H - 45);

                ctx.stroke();

                ctx.restore();

                ctx.fillStyle = accentColor;

                ctx.textAlign = "center";

                ctx.font = "700 16px 'Montserrat', sans-serif";

                ctx.fillText("CUT", W / 2, 10);

                ctx.fillText("CUT", W / 2, H - 10);

                return;
            }

            if (template === 'grid4') {
                const featuredPhotoX = 95;
                const featuredPhotoWidth = 900;
                const detailsWidth = 650;
                const detailsX = (featuredPhotoX + featuredPhotoWidth + W - 30 - detailsWidth) / 2;
                drawPhotoFrame(ctx, images[0], featuredPhotoX, 105, featuredPhotoWidth, 555, accentColor, 6);
                drawEventDetails(ctx, fontColor, accentColor, detailsX, 145, detailsWidth, 465, 53, logoImage);

                const photoY = 760;
                const photoWidth = 500;
                const photoHeight = 320;
                const photoGap = (W - 3 * photoWidth) / 4;
                [1, 2, 3].forEach((imageIndex, index) => {
                    const photoX = photoGap + index * (photoWidth + photoGap);
                    drawPhotoFrame(ctx, images[imageIndex], photoX, photoY, photoWidth, photoHeight, accentColor, 6);
                });
            }

            if (template === 'portrait4') {
                const photoWidth = 450;
                const photoHeight = 490;
                const photoPositions = [
                    [120, 145],
                    [630, 145],
                    [120, 675],
                    [630, 675]
                ];

                photoPositions.forEach(([x, y], index) => {
                    drawPhotoFrame(ctx, images[index], x, y, photoWidth, photoHeight, accentColor, 6);
                });

                drawPortraitEventCaption(ctx, W, fontColor, accentColor, logoImage);
            }
        }

        function drawStripEventCaption(ctx, stripX, stripWidth, canvasHeight, fontColor, accentColor, backgroundColor) {
            const plaqueY = canvasHeight - 340;
            const plaqueHeight = 240;
            const centerX = stripX + stripWidth / 2;
            const textWidth = stripWidth - 112;
            const lines = [];

            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            lines.push({
                text: "CELEBRATING",
                color: fontColor,
                font: "700 22px 'Montserrat', sans-serif",
                height: 30
            });

            ctx.font = `700 32px '${state.eventData.fonts.title}', serif`;
            const titleWords = state.eventData.title.split(/\s+/);
            let titleLine = "";
            titleWords.forEach(word => {
                const candidate = titleLine ? `${titleLine} ${word}` : word;
                if (titleLine && ctx.measureText(candidate).width > textWidth) {
                    lines.push({ text: titleLine, color: fontColor, font: ctx.font, height: 40 });
                    titleLine = word;
                } else {
                    titleLine = candidate;
                }
            });
            if (titleLine) {
                lines.push({ text: titleLine, color: fontColor, font: ctx.font, height: 40 });
            }

            if (state.eventData.date) {
                lines.push({
                    text: formatEventDate(state.eventData.date),
                    color: fontColor,
                    font: `700 22px '${state.eventData.fonts.date}', serif`,
                    height: 30
                });
            }

            if (state.eventData.subtitle) {
                lines.push({
                    text: state.eventData.subtitle,
                    color: fontColor,
                    font: `700 18px '${state.eventData.fonts.subtitle}', sans-serif`,
                    height: 26
                });
            }

            ctx.restore();

            drawThemedTextPlaque(
                ctx,
                stripX + 24,
                plaqueY,
                stripWidth - 48,
                plaqueHeight,
                accentColor,
                backgroundColor,
                0.67
            );

            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const lineGap = 8;
            const contentHeight = lines.reduce((total, line) => total + line.height, 0) + lineGap * Math.max(0, lines.length - 1);
            let lineY = plaqueY + (plaqueHeight - contentHeight) / 2;
            lines.forEach(line => {
                ctx.fillStyle = line.color;
                ctx.font = line.font;
                ctx.fillText(line.text, centerX, lineY + line.height / 2, textWidth);
                lineY += line.height + lineGap;
            });
            ctx.restore();
        }

        function drawPhotoFrame(ctx, image, x, y, width, height, accentColor, lineWidth) {
            drawCroppedImage(ctx, image, x, y, width, height);
            ctx.strokeStyle = accentColor;
            ctx.lineWidth = lineWidth;
            ctx.strokeRect(x, y, width, height);
        }

        function drawLogoImage(ctx, image, centerX, topY, maxWidth, maxHeight) {
            const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
            const width = image.width * scale;
            const height = image.height * scale;
            ctx.drawImage(image, centerX - width / 2, topY + (maxHeight - height) / 2, width, height);
        }

        function drawSingleEventCaption(ctx, fontColor, accentColor, canvasWidth) {
            const centerX = canvasWidth / 2;
            const textWidth = canvasWidth - 240;
            const plaqueY = 882;
            const plaqueHeight = 250;
            const lines = [{
                text: "CELEBRATING",
                color: fontColor,
                font: "700 24px 'Montserrat', sans-serif",
                height: 32
            }, {
                text: state.eventData.title,
                color: fontColor,
                font: `700 52px '${state.eventData.fonts.title}', serif`,
                height: 62
            }];

            if (state.eventData.date) {
                lines.push({
                    text: formatEventDate(state.eventData.date),
                    color: fontColor,
                    font: `700 30px '${state.eventData.fonts.date}', serif`,
                    height: 39
                });
            }

            if (state.eventData.subtitle) {
                lines.push({
                    text: state.eventData.subtitle,
                    color: fontColor,
                    font: `700 25px '${state.eventData.fonts.subtitle}', sans-serif`,
                    height: 32
                });
            }

            drawThemedTextPlaque(ctx, 150, plaqueY, canvasWidth - 300, plaqueHeight, accentColor, getOverlayThemeColors().background, 0.82);

            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const lineGap = 5;
            const contentHeight = lines.reduce((total, line) => total + line.height, 0) + lineGap * (lines.length - 1);
            let lineY = plaqueY + (plaqueHeight - contentHeight) / 2;
            lines.forEach(line => {
                ctx.fillStyle = line.color;
                ctx.font = line.font;
                ctx.fillText(line.text, centerX, lineY + line.height / 2, textWidth);
                lineY += line.height + lineGap;
            });

            ctx.restore();
        }

        function drawPortraitEventCaption(ctx, canvasWidth, fontColor, accentColor, logoImage) {
            const centerX = canvasWidth / 2;
            const plaqueY = logoImage ? 1280 : 1225;
            const plaqueHeight = 475;
            const maxTextWidth = canvasWidth - 300;
            const lines = [];

            if (logoImage) {
                drawLogoImage(ctx, logoImage, centerX, 1180, 190, 90);
            }

            drawThemedTextPlaque(ctx, 110, plaqueY, canvasWidth - 220, plaqueHeight, accentColor, getOverlayThemeColors().background);

            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            lines.push({
                text: "CELEBRATING",
                font: "700 24px 'Montserrat', sans-serif",
                color: fontColor,
                height: 32
            });

            ctx.font = `700 60px '${state.eventData.fonts.title}', serif`;
            wrapCaptionText(ctx, state.eventData.title, maxTextWidth, 2).forEach(text => {
                lines.push({ text, font: ctx.font, color: fontColor, height: 70 });
            });

            if (state.eventData.date) {
                lines.push({
                    text: formatEventDate(state.eventData.date),
                    font: `700 40px '${state.eventData.fonts.date}', serif`,
                    color: fontColor,
                    height: 50
                });
            }

            if (state.eventData.subtitle) {
                ctx.font = `700 34px '${state.eventData.fonts.subtitle}', sans-serif`;
                wrapCaptionText(ctx, state.eventData.subtitle, maxTextWidth, 2).forEach(text => {
                    lines.push({ text, font: ctx.font, color: "#888888", height: 44 });
                });
            }

            const lineGap = 10;
            const contentHeight = lines.reduce((total, line) => total + line.height, 0) +
                lineGap * Math.max(0, lines.length - 1);
            let lineY = plaqueY + (plaqueHeight - contentHeight) / 2;
            lines.forEach(line => {
                ctx.fillStyle = line.color;
                ctx.font = line.font;
                ctx.fillText(line.text, centerX, lineY + line.height / 2, maxTextWidth);
                lineY += line.height + lineGap;
            });
            ctx.restore();
        }

        function wrapCaptionText(ctx, text, maxWidth, maxLines) {
            const words = text.trim().split(/\s+/).filter(Boolean);
            const lines = [];
            let line = "";

            words.forEach(word => {
                const candidate = line ? `${line} ${word}` : word;
                if (line && ctx.measureText(candidate).width > maxWidth) {
                    lines.push(line);
                    line = word;
                } else {
                    line = candidate;
                }
            });
            if (line) lines.push(line);

            if (lines.length > maxLines) {
                lines.length = maxLines;
                let lastLine = lines[maxLines - 1];
                while (lastLine && ctx.measureText(`${lastLine}…`).width > maxWidth) {
                    lastLine = lastLine.slice(0, -1).trimEnd();
                }
                lines[maxLines - 1] = `${lastLine}…`;
            }

            return lines;
        }

        function drawEventDetails(ctx, fontColor, accentColor, x, y, width, height, titleSize, logoImage = null) {
            const centerX = x + width / 2;
            const title = state.eventData.title;
            const maxLineWidth = width - 40;
            const logoHeight = logoImage ? 82 : 0;

            drawThemedTextPlaque(ctx, x + 8, y + 8, width - 16, height - 16, accentColor, getOverlayThemeColors().background);

            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            if (logoImage) {
                drawLogoImage(ctx, logoImage, centerX, y + 18, 170, 82);
            }
            const lines = [{
                text: "CELEBRATING",
                color: fontColor,
                font: "700 24px 'Montserrat', sans-serif",
                height: 32
            }];

            ctx.font = `700 ${titleSize}px '${state.eventData.fonts.title}', serif`;
            const titleFont = ctx.font;
            const words = title.trim().split(/\s+/).filter(Boolean);
            let line = "";
            for (const word of words) {
                const candidate = line ? `${line} ${word}` : word;
                if (line && ctx.measureText(candidate).width > maxLineWidth) {
                    lines.push({ text: line, color: fontColor, font: titleFont, height: titleSize * 1.12 });
                    line = word;
                } else {
                    line = candidate;
                }
            }
            if (line) lines.push({ text: line, color: fontColor, font: titleFont, height: titleSize * 1.12 });

            if (state.eventData.date) {
                lines.push({
                    text: formatEventDate(state.eventData.date),
                    color: fontColor,
                    font: `700 25px '${state.eventData.fonts.date}', serif`,
                    height: 34
                });
            }
            if (state.eventData.subtitle) {
                lines.push({
                    text: state.eventData.subtitle,
                    color: "#888888",
                    font: `700 20px '${state.eventData.fonts.subtitle}', sans-serif`,
                    height: 28
                });
            }

            const lineGap = 12;
            const contentHeight = lines.reduce((total, item) => total + item.height, 0) +
                lineGap * (lines.length - 1);
            const preferredTop = y + (logoImage ? logoHeight + 30 : 24);
            const centeredTop = y + (height - contentHeight) / 2;
            let lineY = Math.max(preferredTop, centeredTop);
            lines.forEach(item => {
                ctx.fillStyle = item.color;
                ctx.font = item.font;
                ctx.fillText(item.text, centerX, lineY + item.height / 2, maxLineWidth);
                lineY += item.height + lineGap;
            });

            ctx.strokeStyle = accentColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(centerX - 75, y + height - 22);
            ctx.lineTo(centerX + 75, y + height - 22);
            ctx.stroke();
            ctx.restore();
        }

        function drawThemedTextPlaque(ctx, x, y, width, height, accentColor, backgroundColor, fillAlpha = 0.82) {
            if (state.printBackground === 'theme') return;

            const inset = 8;
            const radius = 18;
            const left = x + inset;
            const top = y + inset;
            const right = x + width - inset;
            const bottom = y + height - inset;
            ctx.save();
            ctx.fillStyle = colorWithAlpha(backgroundColor, fillAlpha);
            ctx.strokeStyle = accentColor;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(left + radius, top);
            ctx.lineTo(right - radius, top);
            ctx.quadraticCurveTo(right, top, right, top + radius);
            ctx.lineTo(right, bottom - radius);
            ctx.quadraticCurveTo(right, bottom, right - radius, bottom);
            ctx.lineTo(left + radius, bottom);
            ctx.quadraticCurveTo(left, bottom, left, bottom - radius);
            ctx.lineTo(left, top + radius);
            ctx.quadraticCurveTo(left, top, left + radius, top);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.strokeStyle = colorWithAlpha(accentColor, 0.72);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(left + 22, top + 10);
            ctx.lineTo(right - 22, top + 10);
            ctx.moveTo(left + 22, bottom - 10);
            ctx.lineTo(right - 22, bottom - 10);
            ctx.stroke();

            ctx.restore();
        }

        function colorWithAlpha(color, alpha) {
            const match = /^#([0-9a-f]{6})$/i.exec(color);
            if (!match) {
                console.error(`Unsupported theme color for text plaque: ${color}`);
                return `rgba(255, 255, 255, ${alpha})`;
            }

            const value = match[1];
            const red = parseInt(value.slice(0, 2), 16);
            const green = parseInt(value.slice(2, 4), 16);
            const blue = parseInt(value.slice(4, 6), 16);
            return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
        }

        function toCalendarDate(value) {
            if (!value) return '';
            if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                const [year, month, day] = value.split('-').map(Number);
                const date = new Date(year, month - 1, day);
                return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
                    ? value
                    : null;
            }

            const legacyDate = /^([A-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/i.exec(value.trim());
            if (!legacyDate) return null;

            const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
            const monthIndex = months.findIndex(month =>
                month === legacyDate[1].toUpperCase() ||
                month.startsWith(legacyDate[1].toUpperCase())
            );
            if (monthIndex < 0) return null;

            const year = Number(legacyDate[3]);
            const day = Number(legacyDate[2]);
            const date = new Date(year, monthIndex, day);
            if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
                return null;
            }

            return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }

        function formatEventDate(value) {
            const calendarDate = toCalendarDate(value);
            if (!calendarDate) return value;

            const [year, month, day] = calendarDate.split('-').map(Number);
            return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
        }

        function getSavedFont(value, fallback) {
            return EVENT_FONT_OPTIONS.some(option => option.value === value) ? value : fallback;
        }

        function syncEventFontInputs() {
            document.getElementById('cfg-title-font').value = state.eventData.fonts.title;
            document.getElementById('cfg-date-font').value = state.eventData.fonts.date;
            document.getElementById('cfg-subtitle-font').value = state.eventData.fonts.subtitle;
        }

        function syncEventDateInputs() {
            const calendarDate = toCalendarDate(state.eventData.date) || '';
            document.getElementById('cfg-date-picker').value = calendarDate;
            document.getElementById('cfg-date-display').value = formatEventDate(calendarDate);
        }

        function updateEventDate(value) {
            const calendarDate = toCalendarDate(value);
            if (calendarDate === null) {
                console.error(`Invalid event date selected: ${value}`);
                document.getElementById('settings-status').textContent =
                    'That date is invalid. Please choose a valid date from the calendar.';
                syncEventDateInputs();
                return;
            }

            state.eventData.date = calendarDate;
            syncEventDateInputs();
            updateHeaderDisplay();
            schedulePersistentBoothSettingsSave();
            if (state.currentScreen === 'review') {
                renderFinalCanvas();
            }
        }

        function updateEventFont(field, font) {
            if (!['title', 'date', 'subtitle'].includes(field) ||
                !EVENT_FONT_OPTIONS.some(option => option.value === font)) {
                console.error(`Invalid event font selection: ${field} / ${font}`);
                return;
            }

            state.eventData.fonts[field] = font;
            schedulePersistentBoothSettingsSave();
            if (state.currentScreen === 'review') {
                renderFinalCanvas();
            }
        }

        function drawCroppedImage(ctx, img, x, y, width, height) {

            const aspectTarget = width / height;

            const sourceWidth = img.naturalWidth || img.width;
            const sourceHeight = img.naturalHeight || img.height;
            const aspectImg = sourceWidth / sourceHeight;

            let sx, sy, sWidth, sHeight;

            if (aspectImg > aspectTarget) {

                sHeight = sourceHeight;

                sWidth = sourceHeight * aspectTarget;

                sx = (sourceWidth - sWidth) / 2;

                sy = 0;

            } else {

                sWidth = sourceWidth;

                sHeight = sourceWidth / aspectTarget;

                sx = 0;

                sy = (sourceHeight - sHeight) / 2;

            }

            ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, width, height);

        }

        function changeOverlayTheme(theme) {
            state.overlayTheme = theme;
            const colors = getOverlayThemeColors(theme);
            state.customThemeColors = { ...colors };
            applyAppTheme(colors);
            document.getElementById('custom-bg-color').value = colors.background;
            document.getElementById('custom-accent-color').value = colors.accent;
            document.getElementById('custom-text-color').value = colors.text;
            const themeNames = {
                gold: 'Elegance Gold',
                sage: 'Botanical Sage',
                minimal: 'Minimal Modern',
                rose: 'Rose Romance',
                ocean: 'Coastal Blue',
                lavender: 'Lavender',
                terracotta: 'Terracotta',
                midnight: 'Midnight'
            };
            document.getElementById('custom-theme-status').textContent = `${themeNames[theme]} selected. Adjust a color to customize it.`;
            document.querySelectorAll('.overlay-theme-option').forEach(button => {
                button.setAttribute('aria-pressed', String(button.dataset.theme === theme));
            });
            schedulePersistentBoothSettingsSave();
            renderFinalCanvas();
        }

        function getOverlayThemeColors(theme = state.overlayTheme) {
            const themes = {
                gold: { background: '#FDFBF7', accent: '#D4AF37', text: '#2C2A29' },
                sage: { background: '#F4F6F4', accent: '#82A479', text: '#363F3B' },
                minimal: { background: '#FFFFFF', accent: '#25201D', text: '#25201D' },
                rose: { background: '#FAF5F5', accent: '#D09595', text: '#581825' },
                ocean: { background: '#F3F7F8', accent: '#397C8A', text: '#20333A' },
                lavender: { background: '#F7F4FA', accent: '#8D79A8', text: '#352D40' },
                terracotta: { background: '#FBF4EF', accent: '#B86645', text: '#492F26' },
                midnight: { background: '#F1F3F7', accent: '#30435C', text: '#1C293B' }
            };
            return themes[theme] || state.customThemeColors;
        }

        function applyCustomOverlayColors() {
            state.customThemeColors = {
                background: document.getElementById('custom-bg-color').value,
                accent: document.getElementById('custom-accent-color').value,
                text: document.getElementById('custom-text-color').value
            };
            state.overlayTheme = 'custom';
            applyAppTheme(state.customThemeColors);
            document.querySelectorAll('.overlay-theme-option').forEach(button => {
                button.setAttribute('aria-pressed', 'false');
            });
            document.getElementById('custom-theme-status').textContent = 'Custom colors applied.';
            schedulePersistentBoothSettingsSave();
            renderFinalCanvas();
        }

        function applyAppTheme(colors) {
            const theme = document.body;
            theme.dataset.appTheme = state.overlayTheme;
            theme.style.setProperty('--app-background', colors.background);
            theme.style.setProperty('--app-surface', mixThemeColors(colors.background, '#FFFFFF', 0.82));
            theme.style.setProperty('--app-soft-surface', mixThemeColors(colors.background, colors.accent, 0.12));
            theme.style.setProperty('--app-border', mixThemeColors(colors.background, colors.accent, 0.36));
            theme.style.setProperty('--app-accent', colors.accent);
            theme.style.setProperty('--app-accent-strong', mixThemeColors(colors.accent, '#000000', 0.2));
            theme.style.setProperty('--app-text', colors.text);
        }

        function mixThemeColors(firstColor, secondColor, secondWeight) {
            const first = firstColor.match(/^#([0-9a-f]{6})$/i);
            const second = secondColor.match(/^#([0-9a-f]{6})$/i);
            if (!first || !second) {
                console.error(`Unable to blend app theme colors: ${firstColor}, ${secondColor}`);
                return firstColor;
            }

            const firstRgb = [0, 2, 4].map(index => parseInt(first[1].slice(index, index + 2), 16));
            const secondRgb = [0, 2, 4].map(index => parseInt(second[1].slice(index, index + 2), 16));
            const blended = firstRgb.map((value, index) =>
                Math.round(value * (1 - secondWeight) + secondRgb[index] * secondWeight)
                    .toString(16)
                    .padStart(2, '0')
            );
            return `#${blended.join('')}`;
        }

        function changeBorderStyle(style) {
            if (!PhotoBoothBorders.hasStyle(style)) {
                console.error(`Unknown photo border style: ${style}`);
                return;
            }

            state.borderStyle = style;
            syncBorderStyleOptions();
            schedulePersistentBoothSettingsSave();
            renderFinalCanvas();
        }

        function syncBorderStyleOptions() {
            PhotoBoothBorders.syncOptions(state.borderStyle, getOverlayThemeColors().accent);
        }

        function handleLogoUpload(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                DOM.logoStatus.textContent = "Choose a supported image file.";
                DOM.logoInput.value = "";
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                DOM.logoStatus.textContent = "That image is larger than 5 MB. Choose a smaller logo file.";
                DOM.logoInput.value = "";
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result !== 'string') {
                    DOM.logoStatus.textContent = "The logo file could not be read. Try another image.";
                    return;
                }
                state.eventLogoDataUrl = reader.result;
                updateLogoPreview();
                DOM.logoStatus.textContent = `${file.name} added. It will appear on the photo design.`;
                schedulePersistentBoothSettingsSave();
                if (state.currentScreen === 'review') {
                    renderFinalCanvas();
                }
            };
            reader.onerror = () => {
                DOM.logoStatus.textContent = "The logo file could not be read. Try another image.";
                console.error("Unable to read the uploaded event logo.");
            };
            reader.readAsDataURL(file);
        }

        function removeEventLogo() {
            state.eventLogoDataUrl = '';
            DOM.logoInput.value = '';
            DOM.logoStatus.textContent = "Logo removed.";
            updateLogoPreview();
            schedulePersistentBoothSettingsSave();
            if (state.currentScreen === 'review') {
                renderFinalCanvas();
            }
        }

        function updateLogoPreview() {
            DOM.logoPreviewContainer.classList.toggle('hidden', !state.eventLogoDataUrl);
            DOM.logoPreviewContainer.classList.toggle('flex', Boolean(state.eventLogoDataUrl));
            DOM.logoPreview.src = state.eventLogoDataUrl || '';
        }


        function openBrowserPrintDialog(dataUrl) {
            return new Promise((resolve, reject) => {
                const printArea = document.getElementById('print-area');
                let pageStyle = document.getElementById('print-page-style');
                if (!pageStyle) {
                    pageStyle = document.createElement('style');
                    pageStyle.id = 'print-page-style';
                    document.head.appendChild(pageStyle);
                }

                const image = new Image();
                image.alt = 'Photo Booth Print';
                image.onload = () => {
                    const isLandscape = image.naturalWidth > image.naturalHeight;

                    pageStyle.textContent = '@page { size: 4in 6in; margin: 0; }';
                    printArea.style.width = '4in';
                    printArea.style.height = '6in';
                    image.classList.toggle('print-landscape', isLandscape);
                    printArea.replaceChildren(image);

                    try {
                        window.print();
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                };
                image.onerror = () => {
                    reject(new Error('Unable to load the photo for printing.'));
                };
                image.src = dataUrl;
            });
        }

        function photoDataUrlToFile(dataUrl) {
            const match = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(dataUrl);
            if (!match) {
                throw new Error('The photo data is not a supported PNG or JPEG image.');
            }

            const binary = atob(match[2]);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            const extension = match[1] === 'image/png' ? 'png' : 'jpg';
            return new File([bytes], `photo-booth.${extension}`, { type: match[1] });
        }

        async function printPhoto(dataUrl) {
            const shouldPauseTimer = pauseAutoReset('print-share');
            try {
                if (typeof File !== 'undefined' && navigator.share && navigator.canShare) {
                    try {
                        const file = photoDataUrlToFile(dataUrl);
                        if (navigator.canShare({ files: [file] })) {
                            await navigator.share({
                                files: [file],
                                title: 'Photo Booth'
                            });
                            return;
                        }
                    } catch (error) {
                        if (error instanceof DOMException && error.name === 'AbortError') {
                            return;
                        }
                        console.error('Could not share the photo:', error);
                        alert('Could not open the iPad share sheet. Opening the browser print dialog instead.');
                    }
                }

                try {
                    await openBrowserPrintDialog(dataUrl);
                } catch (error) {
                    console.error('Could not open the browser print dialog:', error);
                    alert('Could not open the browser print dialog.');
                }
            } finally {
                if (shouldPauseTimer) {
                    resumeAutoReset('print-share');
                }
            }
        }

        function triggerPrint() {
            printPhoto(DOM.canvas.toDataURL('image/png'));
        }

        function downloadPhoto() {
            const link = document.createElement('a');
            link.download = 'photo-booth.jpg';
            link.href = DOM.canvas.toDataURL('image/jpeg', 0.92);
            link.click();
        }

        async function loadRecentGallery() {
            try {
                const database = await openBoothSettingsDatabase();
                const photos = await new Promise((resolve, reject) => {
                    const transaction = database.transaction(BOOTH_GALLERY_STORE, 'readonly');
                    const request = transaction.objectStore(BOOTH_GALLERY_STORE).get(BOOTH_GALLERY_KEY);
                    request.onsuccess = () => resolve(request.result || []);
                    request.onerror = () => reject(request.error || new Error('Unable to read recent photos.'));
                    transaction.onabort = () => reject(transaction.error || new Error('Reading recent photos was interrupted.'));
                });

                if (!Array.isArray(photos) || photos.some(photo => typeof photo !== 'string')) {
                    throw new Error('Saved recent photos have an invalid format.');
                }

                state.recentGallery = photos.slice(0, 12);
                state.galleryStorageError = '';
                renderGalleryGrid();
            } catch (error) {
                state.galleryStorageError = 'Recent photos could not be loaded from this device.';
                console.error('Unable to load recent photos.', error);
                renderGalleryGrid();
            }
        }

        async function saveToRecentGallery(dataUrl) {
            state.recentGallery.unshift(dataUrl);
            state.recentGallery = state.recentGallery.slice(0, 12);
            state.galleryStorageError = '';
            renderGalleryGrid();

            try {
                const database = await openBoothSettingsDatabase();
                await new Promise((resolve, reject) => {
                    const transaction = database.transaction(BOOTH_GALLERY_STORE, 'readwrite');
                    transaction.objectStore(BOOTH_GALLERY_STORE).put(state.recentGallery, BOOTH_GALLERY_KEY);
                    transaction.oncomplete = resolve;
                    transaction.onerror = () => reject(transaction.error || new Error('Unable to save recent photos.'));
                    transaction.onabort = () => reject(transaction.error || new Error('Saving recent photos was interrupted.'));
                });
            } catch (error) {
                state.galleryStorageError = 'Recent photos are visible for now but could not be saved on this device.';
                console.error('Unable to save recent photos.', error);
                renderGalleryGrid();
            }
        }

        function toggleGalleryModal() {

            const modal = DOM.galleryModal;

            if (modal.classList.contains('hidden')) {

                modal.classList.remove('hidden');

                renderGalleryGrid();

            } else {

                modal.classList.add('hidden');

            }

        }

        function renderGalleryGrid() {

            const grid = document.getElementById('gallery-grid');
            document.getElementById('gallery-status').textContent = state.galleryStorageError;

            grid.innerHTML = "";

            if (state.recentGallery.length === 0) {
                grid.innerHTML = `<div class="col-span-full text-center py-12 text-gray-400 text-sm">${state.galleryStorageError || 'No recent photos saved on this device.'}</div>`;
                return;

            }

            state.recentGallery.forEach((imgData, idx) => {

                const item = document.createElement('div');

                item.className = "relative group rounded-xl overflow-hidden border border-champagne shadow-sm bg-warmSand";

                item.innerHTML = `

                    <img src="${imgData}" class="w-full h-auto object-cover">

                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center space-x-2">

                        <button onclick="reprintGalleryImage('${imgData}')" class="p-2 bg-white rounded-full text-charcoal shadow hover:bg-gold hover:text-white transition" title="Print Photo">

                            <i data-lucide="printer" class="w-4 h-4"></i>

                        </button>

                    </div>

                `;

                grid.appendChild(item);

            });

            lucide.createIcons();

        }

        function reprintGalleryImage(imgData) {

            printPhoto(imgData);

        }

        function startAutoResetTimer() {

            clearInterval(state.autoResetTimer);

            state.resetCountdownRemaining = parseInt(state.eventData.resetSeconds);
            state.autoResetPauseReasons.clear();

            const timerDisplay = document.getElementById('auto-reset-timer');

            if (timerDisplay) timerDisplay.textContent = state.resetCountdownRemaining;

            resumeAutoResetTimer();

        }

        function resumeAutoResetTimer() {
            if (state.currentScreen !== 'review' || state.autoResetTimer !== null || state.autoResetPauseReasons.size > 0) return;

            const timerDisplay = document.getElementById('auto-reset-timer');
            state.autoResetTimer = setInterval(() => {

                state.resetCountdownRemaining--;

                if (timerDisplay) timerDisplay.textContent = state.resetCountdownRemaining;

                if (state.resetCountdownRemaining <= 0) {

                    clearInterval(state.autoResetTimer);
                    state.autoResetTimer = null;
                    state.autoResetPauseReasons.clear();

                    resetToHome();

                }

            }, 1000);

        }

        function resetToHome() {

            clearInterval(state.autoResetTimer);
            state.autoResetTimer = null;
            state.autoResetPauseReasons.clear();

            state.capturedImages = [];

            switchScreen('mode');

        }

        function pauseAutoReset(reason) {
            if (state.currentScreen !== 'review') return false;

            state.autoResetPauseReasons.add(reason);
            clearInterval(state.autoResetTimer);
            state.autoResetTimer = null;
            return true;
        }

        function resumeAutoReset(reason) {
            state.autoResetPauseReasons.delete(reason);
            resumeAutoResetTimer();
        }

        function openAdminPanel() {
            pauseAutoReset('admin');
            DOM.adminDrawer.classList.remove('translate-x-full');
            if (state.selectedCameraId &&
                !Array.from(DOM.cameraSelect.options).some(option => option.value === state.selectedCameraId)) {
                const savedCameraOption = new Option('Saved camera', state.selectedCameraId);
                savedCameraOption.dataset.savedCamera = 'true';
                DOM.cameraSelect.add(savedCameraOption);
            }
            DOM.cameraSelect.value = state.selectedCameraId;
            syncEventFontInputs();
            syncEventDateInputs();
            syncPrintBackgroundOptions();
            document.getElementById('custom-bg-color').value = state.customThemeColors.background;
            document.getElementById('custom-accent-color').value = state.customThemeColors.accent;
            document.getElementById('custom-text-color').value = state.customThemeColors.text;
            document.querySelectorAll('.overlay-theme-option').forEach(button => {
                button.setAttribute('aria-pressed', String(button.dataset.theme === state.overlayTheme));
            });
            syncBorderStyleOptions();
            document.getElementById('custom-theme-status').textContent = state.overlayTheme === 'custom'
                ? 'Custom colors applied.'
                : 'Choose a palette or customize its colors.';
        }

        function closeAdminPanel() {

            DOM.adminDrawer.classList.add('translate-x-full');
            resumeAutoReset('admin');

        }

        function initializePrintBackground() {
            const image = DOM.printBackgroundImage;
            const button = document.querySelector('[data-print-background="water-lilies"]');
            const status = document.getElementById('print-background-status');

            const handleImageLoad = () => {
                button.disabled = false;
                status.textContent = 'Water Lilies is ready. It appears around photos and in layout gaps.';
            };

            const handleImageError = () => {
                button.disabled = true;
                status.textContent = 'The Water Lilies background could not be loaded.';
                console.error('Unable to load the Water Lilies print background.');
            };

            if (image.complete) {
                if (image.naturalWidth > 0) {
                    handleImageLoad();
                } else {
                    handleImageError();
                }
                return;
            }

            image.addEventListener('load', handleImageLoad, { once: true });
            image.addEventListener('error', handleImageError, { once: true });
        }

        function setPrintBackground(background) {
            if (!['theme', 'water-lilies', 'custom'].includes(background)) {
                console.error(`Unknown print background: ${background}`);
                return;
            }

            if (background === 'water-lilies' && DOM.printBackgroundImage.naturalWidth === 0) {
                document.getElementById('print-background-status').textContent =
                    'The Water Lilies background is not available. Try reloading the app.';
                return;
            }

            if (background === 'custom' && !state.customPrintBackgroundImage) {
                DOM.printBackgroundFileInput.click();
                return;
            }

            state.printBackground = background;
            syncPrintBackgroundOptions();
            schedulePersistentBoothSettingsSave();
            document.getElementById('print-background-status').textContent =
                background === 'theme'
                    ? 'Using the background color from the selected frame theme.'
                    : background === 'water-lilies'
                        ? 'Water Lilies appears around photos and in layout gaps.'
                        : `${state.customPrintBackgroundName} appears around photos and in layout gaps.`;

            if (state.currentScreen === 'review') {
                renderFinalCanvas();
            }
        }

        function handlePrintBackgroundUpload(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;

            const status = document.getElementById('print-background-status');
            if (!file.type.startsWith('image/')) {
                status.textContent = 'Choose a supported image file.';
                DOM.printBackgroundFileInput.value = '';
                return;
            }

            if (file.size > 10 * 1024 * 1024) {
                status.textContent = 'That image is larger than 10 MB. Choose a smaller background image.';
                DOM.printBackgroundFileInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result !== 'string') {
                    status.textContent = 'The background image could not be read. Try another file.';
                    DOM.printBackgroundFileInput.value = '';
                    return;
                }

                const image = new Image();
                image.onload = () => {
                    state.customPrintBackgroundImage = image;
                    state.customPrintBackgroundName = file.name;
                    document.getElementById('custom-print-background-preview').src = reader.result;
                    document.getElementById('custom-print-background-preview').classList.remove('hidden');
                    document.getElementById('custom-print-background-placeholder').classList.add('hidden');
                    document.getElementById('custom-print-background-name').textContent = file.name;
                    document.getElementById('custom-print-background-remove').classList.remove('hidden');
                    state.printBackground = 'custom';
                    syncPrintBackgroundOptions();
                    schedulePersistentBoothSettingsSave();
                    status.textContent = `${file.name} selected. It appears around photos and in layout gaps.`;
                    DOM.printBackgroundFileInput.value = '';

                    if (state.currentScreen === 'review') {
                        renderFinalCanvas();
                    }
                };
                image.onerror = () => {
                    status.textContent = 'The selected file is not a supported image. Choose another file.';
                    console.error('Unable to load the uploaded print background image.');
                    DOM.printBackgroundFileInput.value = '';
                };
                image.src = reader.result;
            };
            reader.onerror = () => {
                status.textContent = 'The background image could not be read. Try another file.';
                console.error('Unable to read the uploaded print background image.');
                DOM.printBackgroundFileInput.value = '';
            };
            reader.readAsDataURL(file);
        }

        function removeCustomPrintBackground() {
            state.customPrintBackgroundImage = null;
            state.customPrintBackgroundName = '';
            DOM.printBackgroundFileInput.value = '';
            document.getElementById('custom-print-background-preview').src = '';
            document.getElementById('custom-print-background-preview').classList.add('hidden');
            document.getElementById('custom-print-background-placeholder').classList.remove('hidden');
            document.getElementById('custom-print-background-name').textContent = '';
            document.getElementById('custom-print-background-remove').classList.add('hidden');

            if (state.printBackground === 'custom') {
                setPrintBackground('theme');
            }
            schedulePersistentBoothSettingsSave();
            document.getElementById('print-background-status').textContent = 'Custom background removed.';
        }

        function syncPrintBackgroundOptions() {
            document.querySelectorAll('.print-background-option').forEach(button => {
                button.setAttribute('aria-pressed', String(button.dataset.printBackground === state.printBackground));
            });
        }

        async function saveAdminSettings() {
            state.selectedCameraId = DOM.cameraSelect.value;
            state.eventData.title = document.getElementById('cfg-title').value.trim().toUpperCase() || "DENNIS & HONG'S WEDDING";

            state.eventData.date = document.getElementById('cfg-date-picker').value;
            state.eventData.subtitle = document.getElementById('cfg-subtitle').value.trim();
            state.eventData.fonts = {
                title: getSavedFont(document.getElementById('cfg-title-font').value, 'Playfair Display'),
                date: getSavedFont(document.getElementById('cfg-date-font').value, 'Cinzel'),
                subtitle: getSavedFont(document.getElementById('cfg-subtitle-font').value, 'Montserrat')
            };

            state.eventData.countdownSeconds = parseInt(document.getElementById('cfg-countdown').value);

            state.eventData.resetSeconds = parseInt(document.getElementById('cfg-reset').value);

            const settingsSaved = await savePersistentBoothSettings();

            updateHeaderDisplay();
            syncEventDateInputs();

            if (settingsSaved) closeAdminPanel();

            if (state.currentScreen === 'review') {

                renderFinalCanvas();

            }

        }

        async function applyBoothConfigurationReset() {
            closeResetBoothConfigurationDialog();
            clearTimeout(boothSettingsSaveTimeout);
            state.selectedTemplate = 'single';
            state.selectedCameraId = '';
            state.overlayTheme = 'gold';
            state.printBackground = 'theme';
            state.customPrintBackgroundImage = null;
            state.customPrintBackgroundName = '';
            state.customThemeColors = {
                background: '#FDFBF7',
                accent: '#D4AF37',
                text: '#2C2A29'
            };
            state.borderStyle = 'classic';
            state.eventLogoDataUrl = '';
            state.eventData = {
                title: "DENNIS & HONG'S WEDDING",
                date: '2028-05-20',
                subtitle: 'Thank you for joining us!',
                fonts: {
                    title: 'Playfair Display',
                    date: 'Cinzel',
                    subtitle: 'Montserrat'
                },
                countdownSeconds: 3,
                resetSeconds: 60
            };

            document.getElementById('cfg-title').value = state.eventData.title;
            document.getElementById('cfg-subtitle').value = state.eventData.subtitle;
            document.getElementById('cfg-countdown').value = String(state.eventData.countdownSeconds);
            document.getElementById('cfg-reset').value = String(state.eventData.resetSeconds);
            document.getElementById('cfg-camera').value = '';
            DOM.cameraSelect.querySelectorAll('option[data-saved-camera]').forEach(option => option.remove());
            DOM.logoInput.value = '';
            DOM.logoStatus.textContent = 'PNG, JPG, SVG, or another browser-supported image. Maximum 5 MB.';
            updateLogoPreview();
            DOM.printBackgroundFileInput.value = '';
            document.getElementById('custom-print-background-preview').src = '';
            document.getElementById('custom-print-background-preview').classList.add('hidden');
            document.getElementById('custom-print-background-placeholder').classList.remove('hidden');
            document.getElementById('custom-print-background-name').textContent = '';
            document.getElementById('custom-print-background-remove').classList.add('hidden');
            document.getElementById('custom-bg-color').value = state.customThemeColors.background;
            document.getElementById('custom-accent-color').value = state.customThemeColors.accent;
            document.getElementById('custom-text-color').value = state.customThemeColors.text;
            document.getElementById('custom-theme-status').textContent = 'Choose a palette or customize its colors.';
            document.getElementById('print-background-status').textContent =
                'Using the background color from the selected frame theme.';
            syncEventFontInputs();
            syncEventDateInputs();
            syncPrintBackgroundOptions();
            applyAppTheme(getOverlayThemeColors());
            syncBorderStyleOptions();
            updateHeaderDisplay();

            const settingsSaved = await savePersistentBoothSettings();
            if (settingsSaved) {
                localStorage.removeItem(EVENT_TEXT_STORAGE_KEY);
                document.getElementById('settings-status').textContent =
                    'Booth settings were reset to their defaults on this device.';
            }

            if (state.currentScreen === 'review') {
                renderFinalCanvas();
            }
        }
