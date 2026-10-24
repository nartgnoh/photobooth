# photobooth

A browser-based photo booth for events. Use a phone, tablet, or computer camera to capture photos, add event details and a themed frame, then download or print the finished design. Designed with iPad and Canon SELPHY printing in mind.

## Features

- Four photo layouts: single landscape, two-photo strip, four-photo grid, and four-photo portrait strip.
- Live camera preview, camera selection, countdown, and multi-shot capture.
- Countdown beeps and a camera-style shutter sound for each photo.
- Event title, date, message, and optional logo on photo designs.
- Built-in frame themes and customizable colors.
- Download photos, print from the browser, and revisit recent captures in the session gallery.
- Installable web app support for using the booth from a Home Screen.

## Run locally

There is no build step or package installation. The camera requires a secure browser context, so open the app through `localhost` rather than directly opening `index.html`.

1. Start a local web server from the project folder:

   ```powershell
   py -m http.server 8000
   ```

   If `py` is not available, try `python -m http.server 8000`.
2. Open [http://localhost:8000](http://localhost:8000) in a modern browser.
3. Allow camera access when prompted.

The page loads Tailwind CSS, Lucide icons, Canvas Confetti, and Google Fonts from external CDNs, so an internet connection is needed for all styling and effects to load.

## Use at an event

1. Open **Event Settings** and configure the event name, date, footer message, optional logo, print theme, camera, countdown, and automatic reset. The event name, date, and footer message are saved in that browser on that device and remain after a refresh or guest reset.
2. Select a photo layout and allow camera access.
3. Frame the shot and tap the shutter. Multi-photo layouts capture the photos in sequence.
4. Review the result. Download it, or choose **Print / Share Photo**. On iPad, choose **Print** from the share sheet, then select the Canon SELPHY.
5. Use the gallery to view or reprint recent captures from the current session.

For iPad use, serve or deploy the app over HTTPS, open it in Safari, and use **Share → Add to Home Screen** to make the booth available as an app.

On iPad, the print action shares the finished image to the system share sheet so guests can choose **Print** and the Canon SELPHY without Safari's webpage URL/footer. This requires iPadOS file sharing support; browsers without it fall back to the browser print dialog. Every browser print job requests a single 4×6-inch portrait postcard page. Landscape designs are rotated 90° for printing; the in-app preview remains unchanged. Connect and configure the printer on the device first.

## Project files

- `index.html` — application interface and web app metadata.
- `app.js` — camera, capture flow, photo composition, gallery, settings, and printing logic.
- `border-frames.js` and `border-frames.css` — decorative frame drawing, available frame options, and their selector previews.
- `styles.css` and `tailwind.config.js` — kiosk, layout, print, and shared theme styles.
- `manifest.json` and `app-icon.*` — installable app metadata and icons.
