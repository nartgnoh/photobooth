# photobooth

A browser-based photo booth for events. Use a phone, tablet, or computer camera to capture photos, add event details and a themed frame, then download or print the finished design. Designed with iPad and Canon SELPHY printing in mind.

## Features

- Four photo layouts: single landscape, two-photo strip, four-photo grid, and four-photo portrait strip.
- Live camera preview, camera selection, countdown, and multi-shot capture.
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

1. Open **Event Settings** and configure the event name, date, footer message, optional logo, print theme, camera, countdown, and automatic reset.
2. Select a photo layout and allow camera access.
3. Frame the shot and tap the shutter. Multi-photo layouts capture the photos in sequence.
4. Review the result. Download it or choose **Print** to open the device's print dialog.
5. Use the gallery to view or reprint recent captures from the current session.

For iPad use, serve or deploy the app over HTTPS, open it in Safari, and use **Share → Add to Home Screen** to make the booth available as an app.

Printing uses the browser's normal print dialog, with each image sized to a single 4×6-inch postcard page (portrait images use 4×6 orientation). Connect and configure the printer on the device first; for a Canon SELPHY, use the print options available through the operating system or AirPrint where supported.

## Project files

- `index.html` — application interface and web app metadata.
- `app.js` — camera, capture, photo rendering, gallery, settings, and printing logic.
- `styles.css` and `tailwind.config.js` — custom styles and theme configuration.
- `manifest.json` and `app-icon.*` — installable app metadata and icons.
