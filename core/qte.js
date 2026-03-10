// QTE System - shrinking circle mechanic
// Circle starts large and shrinks to 0 over ~2 seconds
// Zones from outside to inside: empty → success → critical → gone (fail)
// Player clicks or presses Space to lock in their position

(function () {
class QTESystem {
  constructor() {
    this._active = false;
    this._resolve = null;
    this._animFrame = null;
    this._el = null;
    this._startTime = null;
    this._duration = 2000; // ms
    this._maxRadius = 140; // px
    this._boundOnKey = this._onKey.bind(this);
    this._boundOnClick = this._onClick.bind(this);
  }

  // Returns a Promise that resolves with 'critical', 'success', or 'fail'
  // type: 'attack' or 'dodge'
  // onResult: optional callback(result) called when QTE completes
  trigger(type, onResult) {
    // If already active, cancel the previous one
    if (this._active) {
      this._cleanup();
    }

    return new Promise((resolve) => {
      this._active = true;
      this._resolve = (result) => {
        if (typeof onResult === 'function') onResult(result);
        resolve(result);
      };

      this._buildUI(type);
      this._startTime = performance.now();
      this._animFrame = requestAnimationFrame((ts) => this._animate(ts));

      // Input listeners
      window.addEventListener('keydown', this._boundOnKey);
    });
  }

  _buildUI(type) {
    // Overlay container
    const overlay = document.createElement('div');
    overlay.id = 'qte-overlay';
    overlay.style.cssText = [
      'position: fixed',
      'top: 0', 'left: 0',
      'width: 100vw', 'height: 100vh',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'z-index: 9999',
      'pointer-events: none',
    ].join(';');

    // Canvas for the shrinking rings
    const canvas = document.createElement('canvas');
    canvas.id = 'qte-canvas';
    canvas.width = (this._maxRadius + 20) * 2;
    canvas.height = (this._maxRadius + 20) * 2;
    canvas.style.cssText = [
      'pointer-events: all',
      'cursor: pointer',
    ].join(';');

    // Label
    const label = document.createElement('div');
    label.id = 'qte-label';
    const labelText = type === 'attack' ? 'ATTAQUE !' : 'ESQUIVE !';
    label.textContent = labelText;
    label.style.cssText = [
      'position: absolute',
      'top: calc(50% - ' + (this._maxRadius + 40) + 'px)',
      'left: 50%',
      'transform: translateX(-50%)',
      'color: #fff',
      'font-size: 1.6rem',
      'font-weight: bold',
      'text-shadow: 0 0 8px #000',
      'pointer-events: none',
      'letter-spacing: 0.1em',
    ].join(';');

    // Hint text
    const hint = document.createElement('div');
    hint.id = 'qte-hint';
    hint.textContent = 'Clic ou Espace';
    hint.style.cssText = [
      'position: absolute',
      'top: calc(50% + ' + (this._maxRadius + 12) + 'px)',
      'left: 50%',
      'transform: translateX(-50%)',
      'color: rgba(255,255,255,0.75)',
      'font-size: 0.85rem',
      'pointer-events: none',
    ].join(';');

    overlay.appendChild(label);
    overlay.appendChild(canvas);
    overlay.appendChild(hint);
    document.body.appendChild(overlay);

    this._el = overlay;
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');

    // Click listener on canvas
    canvas.addEventListener('click', this._boundOnClick);
  }

  _animate(timestamp) {
    if (!this._active) return;

    const elapsed = timestamp - this._startTime;
    const progress = Math.min(elapsed / this._duration, 1.0);
    // Current radius shrinks from maxRadius to 0
    const currentRadius = this._maxRadius * (1 - progress);

    this._draw(currentRadius);

    if (progress >= 1.0) {
      // Auto-fail — circle disappeared
      this._finish('fail');
      return;
    }

    this._animFrame = requestAnimationFrame((ts) => this._animate(ts));
  }

  _draw(currentRadius) {
    const ctx = this._ctx;
    const canvas = this._canvas;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const max = this._maxRadius;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw static zone rings (fixed radii showing target zones)
    // Zones: success = 65%–35%, critical = 35%–15%, fail = below 15%
    const successOuter = max * 0.65;
    const successInner = max * 0.35;
    const critOuter    = max * 0.35;
    const critInner    = max * 0.15;

    // Draw preview / outer ring (empty zone)
    this._drawRing(ctx, cx, cy, max, successOuter, 'rgba(255,255,255,0.08)');

    // Success zone (green)
    this._drawRing(ctx, cx, cy, successOuter, successInner, 'rgba(80,220,80,0.28)');

    // Critical zone (gold)
    this._drawRing(ctx, cx, cy, critOuter, critInner, 'rgba(255,210,0,0.40)');

    // Fail zone center (dark red)
    this._drawDisc(ctx, cx, cy, critInner, 'rgba(180,40,40,0.30)');

    // Draw zone borders
    this._drawCircle(ctx, cx, cy, successOuter, 'rgba(80,220,80,0.6)', 1.5);
    this._drawCircle(ctx, cx, cy, successInner, 'rgba(80,220,80,0.6)', 1.5);
    this._drawCircle(ctx, cx, cy, critInner, 'rgba(255,210,0,0.8)', 1.5);

    // Draw the moving circle (the one that shrinks)
    if (currentRadius > 0) {
      const zone = this._getZone(currentRadius, max);
      let movingColor;
      if (zone === 'critical') movingColor = '#ffd200';
      else if (zone === 'success') movingColor = '#50dc50';
      else if (zone === 'fail') movingColor = '#cc2222';
      else movingColor = 'rgba(255,255,255,0.8)';

      this._drawCircle(ctx, cx, cy, currentRadius, movingColor, 3);

      // Glow on the moving circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
      ctx.strokeStyle = movingColor;
      ctx.lineWidth = 8;
      ctx.globalAlpha = 0.25;
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawRing(ctx, cx, cy, outerR, innerR, fill) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2, false);
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  }

  _drawDisc(ctx, cx, cy, r, fill) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  }

  _drawCircle(ctx, cx, cy, r, stroke, lineWidth) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.restore();
  }

  _onClick() {
    if (!this._active) return;
    this._commit();
  }

  _onKey(e) {
    if (!this._active) return;
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      this._commit();
    }
  }

  _commit() {
    if (!this._active) return;

    const elapsed = performance.now() - this._startTime;
    const progress = Math.min(elapsed / this._duration, 1.0);
    const currentRadius = this._maxRadius * (1 - progress);
    const result = this._getZone(currentRadius, this._maxRadius);

    this._finish(result === 'empty' ? 'fail' : result);
  }

  _finish(result) {
    if (!this._active) return;

    // Show brief result flash before cleanup
    this._showResultFlash(result);

    const resolveCallback = this._resolve;
    setTimeout(() => {
      this._cleanup();
      if (resolveCallback) resolveCallback(result);
    }, 420);
  }

  _showResultFlash(result) {
    if (!this._canvas || !this._ctx) return;
    const ctx = this._ctx;
    const canvas = this._canvas;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let text, color;
    if (result === 'critical') {
      text = 'CRITIQUE !';
      color = '#ffd200';
    } else if (result === 'success') {
      text = 'SUCCÈS';
      color = '#50dc50';
    } else {
      text = 'RATÉ';
      color = '#cc2222';
    }

    ctx.save();
    ctx.font = 'bold 2.2rem sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 10;
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }

  _cleanup() {
    this._active = false;
    this._resolve = null;
    this._startTime = null;

    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }

    window.removeEventListener('keydown', this._boundOnKey);

    if (this._canvas) {
      this._canvas.removeEventListener('click', this._boundOnClick);
      this._canvas = null;
      this._ctx = null;
    }

    if (this._el) {
      this._el.remove();
      this._el = null;
    }
  }

  // Calculate result based on current circle size
  // pct = currentRadius / maxRadius
  // 0.65..1.0 → empty (too early)
  // 0.35..0.65 → success
  // 0.15..0.35 → critical
  // 0.00..0.15 → fail (too late)
  _getZone(currentRadius, maxRadius) {
    const pct = currentRadius / maxRadius;
    if (pct < 0.15) return 'fail';
    if (pct < 0.35) return 'critical';
    if (pct < 0.65) return 'success';
    return 'empty';
  }
}

window.QTESystem = new QTESystem();
})();
