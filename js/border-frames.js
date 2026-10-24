(function () {
    const styles = [
        { id: 'classic', label: 'Double Lines' },
        { id: 'minimal', label: 'Single Line' },
        { id: 'pearl', label: 'Dots' },
        { id: 'dashed', label: 'Dashes' },
        { id: 'artDeco', label: 'Art Deco' },
        { id: 'corner', label: 'Gilded Corners' },
        { id: 'scalloped', label: 'Scalloped Wave' },
        { id: 'stamp', label: 'Postage Stamp' },
        { id: 'botanical', label: 'Botanical Corners' },
    ];

    function renderOptions(containerId, density) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Border options container "${containerId}" was not found.`);
            return;
        }

        container.replaceChildren();
        styles.forEach(({ id, label }) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'border-style-option';
            button.dataset.borderStyle = id;
            button.setAttribute('aria-pressed', 'false');
            button.setAttribute('aria-label', label);

            const preview = document.createElement('span');
            preview.className = `border-option-swatch border-option-swatch--${id}`;
            preview.setAttribute('aria-hidden', 'true');

            const caption = document.createElement('span');
            caption.className = 'border-option-label';
            caption.textContent = label;

            button.append(preview, caption);
            button.addEventListener('click', () => window.changeBorderStyle(id));
            container.appendChild(button);
        });

        container.classList.add('border-style-options', `border-style-options--${density}`);
    }

    function syncOptions(selectedStyle, accentColor) {
        document.querySelectorAll('.border-style-option').forEach(button => {
            const selected = button.dataset.borderStyle === selectedStyle;
            button.setAttribute('aria-pressed', String(selected));
            button.style.setProperty('--border-accent', accentColor);
        });
    }

    function hasStyle(styleId) {
        return styles.some(style => style.id === styleId);
    }

    function drawDecorativeFrame(ctx, x, y, width, height, color, style) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;

        if (style === 'stamp') {
            const inset = 20;
            const corner = 9;
            const left = x + inset;
            const top = y + inset;
            const right = x + width - inset;
            const bottom = y + height - inset;

            ctx.lineWidth = 4;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(left + corner, top);
            traceScallopedEdge(ctx, left + corner, top, right - corner, top, 9, 0, 1, 24);
            ctx.quadraticCurveTo(right, top, right, top + corner);
            traceScallopedEdge(ctx, right, top + corner, right, bottom - corner, 9, -1, 0, 24);
            ctx.quadraticCurveTo(right, bottom, right - corner, bottom);
            traceScallopedEdge(ctx, right - corner, bottom, left + corner, bottom, 9, 0, -1, 24);
            ctx.quadraticCurveTo(left, bottom, left, bottom - corner);
            traceScallopedEdge(ctx, left, bottom - corner, left, top + corner, 9, 1, 0, 24);
            ctx.quadraticCurveTo(left, top, left + corner, top);
            ctx.closePath();
            ctx.stroke();

            ctx.lineWidth = 2.5;
            ctx.strokeRect(x + 38, y + 38, width - 76, height - 76);
        } else if (style === 'scalloped') {
            const inset = 24;
            const corner = 20;
            const left = x + inset;
            const top = y + inset;
            const right = x + width - inset;
            const bottom = y + height - inset;

            ctx.lineWidth = 5;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(left + corner, top);
            traceScallopedEdge(ctx, left + corner, top, right - corner, top, 16, 0, -1, 54);
            ctx.quadraticCurveTo(right, top, right, top + corner);
            traceScallopedEdge(ctx, right, top + corner, right, bottom - corner, 16, 1, 0, 54);
            ctx.quadraticCurveTo(right, bottom, right - corner, bottom);
            traceScallopedEdge(ctx, right - corner, bottom, left + corner, bottom, 16, 0, 1, 54);
            ctx.quadraticCurveTo(left, bottom, left, bottom - corner);
            traceScallopedEdge(ctx, left, bottom - corner, left, top + corner, 16, -1, 0, 54);
            ctx.quadraticCurveTo(left, top, left + corner, top);
            ctx.closePath();
            ctx.stroke();

            ctx.lineWidth = 2.5;
            ctx.strokeRect(x + 42, y + 42, width - 84, height - 84);
        } else if (style === 'minimal') {
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 12, y + 12, width - 24, height - 24);
        } else if (style === 'dashed') {
            ctx.setLineDash([14, 9]);
            ctx.strokeRect(x + 7, y + 7, width - 14, height - 14);
            ctx.setLineDash([]);
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 17, y + 17, width - 34, height - 34);
        } else if (style === 'pearl') {
            ctx.lineCap = 'round';
            ctx.setLineDash([1, 12]);
            ctx.strokeRect(x + 5, y + 5, width - 10, height - 10);
            ctx.setLineDash([]);
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 16, y + 16, width - 32, height - 32);
        } else {
            ctx.strokeRect(x + 5, y + 5, width - 10, height - 10);
            ctx.lineWidth = 2.5;
            ctx.strokeRect(x + 15, y + 15, width - 30, height - 30);

            if (style === 'corner') {
                const size = 72;
                const corners = [
                    { x: x + 24, y: y + 24, sx: 1, sy: 1 },
                    { x: x + width - 24, y: y + 24, sx: -1, sy: 1 },
                    { x: x + 24, y: y + height - 24, sx: 1, sy: -1 },
                    { x: x + width - 24, y: y + height - 24, sx: -1, sy: -1 }
                ];
                ctx.lineWidth = 6;
                corners.forEach(corner => {
                    ctx.beginPath();
                    ctx.moveTo(corner.x + corner.sx * size, corner.y);
                    ctx.lineTo(corner.x, corner.y);
                    ctx.lineTo(corner.x, corner.y + corner.sy * size);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(corner.x, corner.y, 5, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                });
            } else if (style === 'artDeco') {
                const cornerSize = 58;
                const offsets = [25, 39, 53];
                const corners = [
                    { x: x + 20, y: y + 20, sx: 1, sy: 1 },
                    { x: x + width - 20, y: y + 20, sx: -1, sy: 1 },
                    { x: x + 20, y: y + height - 20, sx: 1, sy: -1 },
                    { x: x + width - 20, y: y + height - 20, sx: -1, sy: -1 }
                ];
                corners.forEach(corner => {
                    offsets.forEach(offset => {
                        ctx.beginPath();
                        ctx.moveTo(corner.x + corner.sx * offset, corner.y);
                        ctx.lineTo(corner.x + corner.sx * (offset + cornerSize), corner.y);
                        ctx.moveTo(corner.x, corner.y + corner.sy * offset);
                        ctx.lineTo(corner.x, corner.y + corner.sy * (offset + cornerSize));
                        ctx.stroke();
                    });
                });
            } else if (style === 'botanical') {
                drawBotanicalCorner(ctx, x + 18, y + 18, 1, 1, color);
                drawBotanicalCorner(ctx, x + width - 18, y + 18, -1, 1, color);
                drawBotanicalCorner(ctx, x + 18, y + height - 18, 1, -1, color);
                drawBotanicalCorner(ctx, x + width - 18, y + height - 18, -1, -1, color);
            }
        }

        ctx.restore();
    }

    function traceScallopedEdge(ctx, startX, startY, endX, endY, amplitude, normalX, normalY, segmentLength = 36) {
        const length = Math.hypot(endX - startX, endY - startY);
        const scallopCount = Math.max(1, Math.round(length / segmentLength));

        for (let i = 0; i < scallopCount; i++) {
            const from = i / scallopCount;
            const to = (i + 1) / scallopCount;
            const middle = (from + to) / 2;
            const endXAtStep = startX + (endX - startX) * to;
            const endYAtStep = startY + (endY - startY) * to;
            const controlX = startX + (endX - startX) * middle + normalX * amplitude;
            const controlY = startY + (endY - startY) * middle + normalY * amplitude;
            ctx.quadraticCurveTo(controlX, controlY, endXAtStep, endYAtStep);
        }
    }

    function drawBotanicalCorner(ctx, x, y, scaleX, scaleY, color) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scaleX, scaleY);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(74, 0);
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 74);
        ctx.moveTo(5, 5);
        ctx.quadraticCurveTo(28, 24, 57, 57);
        ctx.stroke();

        ctx.fillStyle = color;
        [[18, 16, -0.55], [33, 31, 0.8], [47, 46, -0.55], [16, 24, 0.8], [27, 38, -0.55], [42, 52, 0.8]].forEach(([leafX, leafY, rotation]) => {
            ctx.save();
            ctx.translate(leafX, leafY);
            ctx.rotate(rotation);
            ctx.beginPath();
            ctx.ellipse(0, 0, 5, 11, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
        ctx.restore();
    }

    window.PhotoBoothBorders = {
        renderOptions,
        syncOptions,
        hasStyle,
        drawDecorativeFrame
    };
})();
