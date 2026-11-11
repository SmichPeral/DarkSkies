/**
 * Sub-Screen ('fov'): Celestron NexStar 8SE High-DPI Eyepiece Field-of-View Simulator
 * Renders realistic visual eyepiece views for all 14 Burlington Showpiece Targets
 * with true angular scaling, live Galilean moons, real Saturn ring tilt, and honest altitudes.
 */

import {
  DEFAULT_EYEPIECES,
  computeEyepieceMatrix,
  getSeeingMaxMagnification,
  getFovSimulatorTargets,
  getDefaultStargazingReferenceDate,
} from '../services/astronomyEngine.js';

export function renderFovSimulatorScreen(container, state, actions) {
  if (!container) return;

  const returnScreen = state?.fovReturnScreen || 'explore';
  const seeingRating = Number(state?.currentHour?.seeing ?? 4);
  const refDate = getDefaultStargazingReferenceDate(new Date());
  const catalog = getFovSimulatorTargets(refDate, { seeingRating });

  function getActiveTarget() {
    const id = state?.selectedTargetId || 'saturn';
    return catalog.targets[id] || catalog.target_list[0];
  }

  function drawStarfield(ctx, cx, cy, r, seed = 1) {
    ctx.fillStyle = '#e2e8f0';
    for (let i = 0; i < 65; i++) {
      const a = ((i * 137.508 + seed * 31) * Math.PI) / 180;
      const dist = Math.sqrt(((i * 29 + seed * 7) % 97) / 97) * r * 0.96;
      const sx = cx + Math.cos(a) * dist;
      const sy = cy + Math.sin(a) * dist;
      const magSize = (i % 5 === 0 ? 1.4 : 0.85);
      ctx.globalAlpha = 0.25 + ((i * 17) % 65) / 100;
      ctx.beginPath();
      ctx.arc(sx, sy, magSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawTargetOnCanvas(canvas, target, epItem, maxUsefulMag) {
    if (!canvas || !target || !epItem) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const size = canvas.clientWidth || 300;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const fovRadius = size / 2 - 10;

    ctx.clearRect(0, 0, size, size);

    // Outer eyepiece rubber barrel housing
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = '#05070c';
    ctx.fill();

    // Clip to circular eyepiece field stop
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, fovRadius, 0, Math.PI * 2);
    ctx.clip();

    // Eyepiece sky background (subtly darker at higher magnification / smaller exit pupil!)
    const exitPupil = parseFloat(epItem.exit_pupil_mm) || 2.5;
    const skyBrightness = Math.min(24, Math.max(5, Math.round(exitPupil * 5.2)));
    const bgGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, fovRadius);
    bgGrad.addColorStop(0, `rgb(${skyBrightness}, ${skyBrightness + 4}, ${skyBrightness + 14})`);
    bgGrad.addColorStop(1, '#04060d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size, size);

    const tfovArcsec = parseFloat(epItem.tfov_deg) * 3600;
    const pxPerArcsec = (fovRadius * 2) / Math.max(120, tfovArcsec);

    // Apply realistic atmospheric seeing softness when pushing past seeing cap
    const overPowerRatio = epItem.magnification / Math.max(90, maxUsefulMag);
    if (overPowerRatio > 1.08 && typeof ctx.filter === 'string') {
      const blurPx = Math.min(3.2, (overPowerRatio - 1.0) * 2.4);
      ctx.filter = `blur(${blurPx.toFixed(1)}px)`;
    }

    const seed = target.id.split('').reduce((s, ch) => s + ch.charCodeAt(0), 0);
    drawStarfield(ctx, cx, cy, fovRadius, seed);

    switch (target.id) {
      case 'saturn': {
        // Visually boost planet scale slightly so low-power still shows recognizable ring character while preserving zoom ratio
        const visualBoost = 2.6;
        const globeR = Math.max(3.2, ((target.angular_size_arcsec * 0.44) / 2) * pxPerArcsec * visualBoost);
        const ringRx = globeR * 2.32;
        const tiltRad = (Math.max(4, Math.abs(target.ring_tilt_deg || 6)) * Math.PI) / 180;
        const ringRy = Math.max(1.8, ringRx * Math.sin(tiltRad));

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.14);

        // Outer A & B Rings
        ctx.beginPath();
        ctx.ellipse(0, 0, ringRx, ringRy, 0, 0, Math.PI * 2);
        ctx.strokeStyle = '#e7d3a8';
        ctx.lineWidth = Math.max(1.6, globeR * 0.36);
        ctx.stroke();

        // Cassini division hint at high power
        if (globeR >= 7) {
          ctx.beginPath();
          ctx.ellipse(0, 0, ringRx * 0.86, ringRy * 0.86, 0, 0, Math.PI * 2);
          ctx.strokeStyle = '#090d16';
          ctx.lineWidth = Math.max(0.8, globeR * 0.08);
          ctx.stroke();
        }

        // Golden oblate globe
        const satGrad = ctx.createLinearGradient(0, -globeR, 0, globeR);
        satGrad.addColorStop(0, '#d6b87c');
        satGrad.addColorStop(0.5, '#f5e1b5');
        satGrad.addColorStop(1, '#bfa065');
        ctx.beginPath();
        ctx.ellipse(0, 0, globeR, globeR * 0.9, 0, 0, Math.PI * 2);
        ctx.fillStyle = satGrad;
        ctx.fill();

        // Titan moon nearby
        const titanDist = Math.min(fovRadius * 0.72, ringRx * 3.1 + 14);
        ctx.beginPath();
        ctx.arc(titanDist, -ringRy * 1.4, 2.1, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
        ctx.filter = 'none';
        ctx.font = '600 8.5px "Spline Sans Mono", monospace';
        ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
        ctx.fillText('Titan', titanDist + 5, -ringRy * 1.4 + 3);
        ctx.restore();
        break;
      }

      case 'jupiter': {
        const visualBoost = 2.4;
        const jupR = Math.max(4.5, (target.angular_size_arcsec / 2) * pxPerArcsec * visualBoost);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.08);

        // Jupiter disk
        const jGrad = ctx.createRadialGradient(-jupR * 0.2, -jupR * 0.2, jupR * 0.1, 0, 0, jupR);
        jGrad.addColorStop(0, '#fff7ed');
        jGrad.addColorStop(0.75, '#e7d5be');
        jGrad.addColorStop(1, '#b89f82');
        ctx.beginPath();
        ctx.ellipse(0, 0, jupR, jupR * 0.93, 0, 0, Math.PI * 2);
        ctx.fillStyle = jGrad;
        ctx.fill();

        // North & South Equatorial Cloud Belts (clipped to disk)
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, 0, jupR, jupR * 0.93, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = 'rgba(154, 91, 56, 0.62)';
        ctx.fillRect(-jupR, -jupR * 0.34, jupR * 2, Math.max(1.2, jupR * 0.17));
        ctx.fillRect(-jupR, jupR * 0.14, jupR * 2, Math.max(1.2, jupR * 0.19));
        ctx.restore();

        // Live Galilean Moons!
        ctx.filter = 'none';
        const moons = target.galilean_moons || [];
        moons.forEach((m, idx) => {
          const mx = m.x_jupiter_radii * jupR * 0.72;
          const my = m.y_jupiter_radii * jupR * 0.72;
          if (Math.abs(mx) < fovRadius * 0.92) {
            ctx.beginPath();
            ctx.arc(mx, my, 2.0, 0, Math.PI * 2);
            ctx.fillStyle = m.color || '#ffffff';
            ctx.fill();

            const labelY = idx % 2 === 0 ? my - 7 : my + 13;
            ctx.font = '600 8px "Spline Sans Mono", monospace';
            ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
            ctx.textAlign = 'center';
            ctx.fillText(m.short, mx, labelY);
          }
        });
        ctx.restore();
        break;
      }

      case 'moon': {
        const moonR = Math.max(36, (target.angular_size_arcsec / 2) * pxPerArcsec);
        const illum = (target.moon_illum_pct ?? 50) / 100;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.beginPath();
        ctx.arc(0, 0, moonR, 0, Math.PI * 2);
        ctx.fillStyle = '#111827';
        ctx.fill();
        ctx.clip();

        // Lit lunar surface
        const litGrad = ctx.createRadialGradient(-moonR * 0.2, -moonR * 0.1, moonR * 0.1, 0, 0, moonR);
        litGrad.addColorStop(0, '#f8fafc');
        litGrad.addColorStop(0.7, '#cbd5e1');
        litGrad.addColorStop(1, '#94a3b8');
        ctx.fillStyle = litGrad;
        ctx.fillRect(-moonR, -moonR, moonR * 2, moonR * 2);

        // Dark lunar maria seas
        ctx.fillStyle = 'rgba(71, 85, 105, 0.36)';
        [
          [-0.25, -0.22, 0.28],
          [0.18, -0.15, 0.22],
          [-0.35, 0.15, 0.24],
          [0.08, 0.22, 0.18],
        ].forEach(([nx, ny, nr]) => {
          ctx.beginPath();
          ctx.arc(nx * moonR, ny * moonR, nr * moonR, 0, Math.PI * 2);
          ctx.fill();
        });

        // Craters along terminator & highlands
        for (let c = 0; c < 26; c++) {
          const cxOff = (((c * 73) % 160) - 80) / 100 * moonR;
          const cyOff = (((c * 47) % 160) - 80) / 100 * moonR;
          const cr = Math.max(2, ((c % 4) + 1.5) * (moonR / 55));
          ctx.beginPath();
          ctx.arc(cxOff, cyOff, cr, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // Shadow terminator mask
        if (illum < 0.96) {
          const shadowX = (illum * 2 - 1) * moonR;
          ctx.fillStyle = 'rgba(5, 8, 17, 0.92)';
          ctx.fillRect(-moonR * 1.2, -moonR * 1.2, moonR * 1.2 - shadowX, moonR * 2.4);
        }
        ctx.restore();
        break;
      }

      case 'm42': {
        const nebR = Math.max(28, (target.angular_size_arcsec / 2) * pxPerArcsec * 0.42);
        const nebGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, nebR);
        nebGrad.addColorStop(0, 'rgba(224, 242, 254, 0.92)');
        nebGrad.addColorStop(0.22, 'rgba(56, 189, 248, 0.52)');
        nebGrad.addColorStop(0.55, 'rgba(139, 92, 246, 0.22)');
        nebGrad.addColorStop(1, 'rgba(6, 9, 16, 0)');

        ctx.save();
        ctx.translate(cx, cy);
        ctx.beginPath();
        ctx.moveTo(-nebR * 0.9, -nebR * 0.5);
        ctx.quadraticCurveTo(0, -nebR * 0.1, nebR * 0.95, -nebR * 0.45);
        ctx.quadraticCurveTo(nebR * 0.3, nebR * 0.85, 0, nebR * 0.9);
        ctx.quadraticCurveTo(-nebR * 0.35, nebR * 0.8, -nebR * 0.9, -nebR * 0.5);
        ctx.fillStyle = nebGrad;
        ctx.fill();

        // The 4 Trapezium baby stars right in the core!
        ctx.filter = 'none';
        const trapSpread = Math.max(3, Math.min(12, pxPerArcsec * 14));
        [
          [-trapSpread * 0.5, -trapSpread * 0.4],
          [trapSpread * 0.5, -trapSpread * 0.3],
          [trapSpread * 0.35, trapSpread * 0.5],
          [-trapSpread * 0.4, trapSpread * 0.45],
        ].forEach(([tx, ty]) => {
          ctx.beginPath();
          ctx.arc(tx, ty, 1.7, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        });
        ctx.restore();
        break;
      }

      case 'm45': {
        const scale = pxPerArcsec * 0.38;
        const sevenSisters = [
          [0, 0, 4.2, 'Alcyone'],
          [-520, -180, 3.6, 'Atlas'],
          [-540, -60, 3.2, 'Pleione'],
          [320, -210, 3.7, 'Merope'],
          [480, 140, 3.8, 'Electra'],
          [380, 380, 3.5, 'Maia'],
          [560, 310, 3.4, 'Taygeta'],
        ];
        sevenSisters.forEach(([ax, ay, rStar]) => {
          const sx = cx + ax * scale;
          const sy = cy + ay * scale;
          const glow = ctx.createRadialGradient(sx, sy, 1, sx, sy, rStar * 5);
          glow.addColorStop(0, 'rgba(186, 230, 253, 0.95)');
          glow.addColorStop(0.35, 'rgba(56, 189, 248, 0.35)');
          glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(sx, sy, rStar * 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#f0f9ff';
          ctx.beginPath();
          ctx.arc(sx, sy, rStar * 0.85, 0, Math.PI * 2);
          ctx.fill();
        });
        break;
      }

      case 'albireo': {
        const sepPx = Math.max(8, Math.min(fovRadius * 0.6, target.angular_size_arcsec * pxPerArcsec * 1.8));
        const pairs = [
          { dx: -sepPx * 0.5, dy: sepPx * 0.25, color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.45)', r: 4.2 },
          { dx: sepPx * 0.5, dy: -sepPx * 0.25, color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.45)', r: 3.1 },
        ];
        pairs.forEach((st) => {
          const g = ctx.createRadialGradient(cx + st.dx, cy + st.dy, 1, cx + st.dx, cy + st.dy, st.r * 4.5);
          g.addColorStop(0, st.color);
          g.addColorStop(0.4, st.glow);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(cx + st.dx, cy + st.dy, st.r * 4.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(cx + st.dx, cy + st.dy, st.r * 0.65, 0, Math.PI * 2);
          ctx.fill();
        });
        break;
      }

      case 'm13': {
        const globR = Math.max(20, (target.angular_size_arcsec / 2) * pxPerArcsec * 0.55);
        const coreGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, globR);
        coreGrad.addColorStop(0, 'rgba(255, 251, 235, 0.92)');
        coreGrad.addColorStop(0.3, 'rgba(226, 232, 240, 0.45)');
        coreGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, globR, 0, Math.PI * 2);
        ctx.fill();

        // 240 resolved pinpoint cluster stars!
        for (let i = 0; i < 240; i++) {
          const ang = i * 2.39996;
          const dist = Math.pow((i + 1) / 240, 0.75) * globR * 1.12;
          const sx = cx + Math.cos(ang) * dist;
          const sy = cy + Math.sin(ang) * dist;
          ctx.fillStyle = i % 7 === 0 ? '#fef3c7' : '#f1f5f9';
          ctx.globalAlpha = Math.max(0.25, 1 - dist / (globR * 1.25));
          ctx.beginPath();
          ctx.arc(sx, sy, i < 40 ? 1.2 : 0.85, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }

      case 'double_cluster': {
        const offset = Math.max(26, 420 * pxPerArcsec * 0.42);
        [
          [cx - offset * 0.58, cy - offset * 0.2],
          [cx + offset * 0.58, cy + offset * 0.2],
        ].forEach(([ccx, ccy], cIdx) => {
          for (let i = 0; i < 95; i++) {
            const ang = i * 2.39996 + cIdx;
            const dist = Math.pow((i + 1) / 95, 0.65) * offset * 0.85;
            const sx = ccx + Math.cos(ang) * dist;
            const sy = ccy + Math.sin(ang) * dist;
            ctx.fillStyle = i === 8 || i === 21 ? '#fca5a5' : '#e0f2fe';
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.arc(sx, sy, i < 12 ? 1.7 : 1.0, 0, Math.PI * 2);
            ctx.fill();
          }
        });
        ctx.globalAlpha = 1;
        break;
      }

      case 'm31': {
        const galRx = Math.max(45, (target.angular_size_arcsec / 2) * pxPerArcsec * 0.35);
        const galRy = galRx * 0.32;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.62);

        const gGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, galRx);
        gGrad.addColorStop(0, 'rgba(255, 251, 235, 0.95)');
        gGrad.addColorStop(0.22, 'rgba(226, 232, 240, 0.52)');
        gGrad.addColorStop(0.65, 'rgba(148, 163, 184, 0.16)');
        gGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.scale(1, galRy / galRx);
        ctx.beginPath();
        ctx.arc(0, 0, galRx, 0, Math.PI * 2);
        ctx.fillStyle = gGrad;
        ctx.fill();
        ctx.restore();

        // Companion M32
        const m32x = cx + galRx * 0.36;
        const m32y = cy + galRx * 0.32;
        const m32Grad = ctx.createRadialGradient(m32x, m32y, 1, m32x, m32y, 12);
        m32Grad.addColorStop(0, 'rgba(255,255,255,0.88)');
        m32Grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = m32Grad;
        ctx.beginPath();
        ctx.arc(m32x, m32y, 12, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'm57': {
        const ringR = Math.max(7, (target.angular_size_arcsec / 2) * pxPerArcsec * 1.8);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(0.4);
        ctx.beginPath();
        ctx.ellipse(0, 0, ringR, ringR * 0.76, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.78)';
        ctx.lineWidth = Math.max(3, ringR * 0.42);
        ctx.stroke();
        ctx.restore();
        break;
      }

      case 'mars': {
        const marsR = Math.max(4, (target.angular_size_arcsec / 2) * pxPerArcsec * 2.8);
        const mGrad = ctx.createRadialGradient(cx - marsR * 0.25, cy - marsR * 0.25, 1, cx, cy, marsR);
        mGrad.addColorStop(0, '#fdba74');
        mGrad.addColorStop(0.65, '#ea580c');
        mGrad.addColorStop(1, '#9a3412');
        ctx.beginPath();
        ctx.arc(cx, cy, marsR, 0, Math.PI * 2);
        ctx.fillStyle = mGrad;
        ctx.fill();

        // Polar ice cap hint
        if (marsR >= 6) {
          ctx.beginPath();
          ctx.arc(cx, cy - marsR * 0.76, marsR * 0.26, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.fill();
        }
        break;
      }

      case 'venus': {
        const venR = Math.max(5, (target.angular_size_arcsec / 2) * pxPerArcsec * 2.4);
        const phase = (target.venus_phase_pct ?? 65) / 100;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.beginPath();
        ctx.arc(0, 0, venR, 0, Math.PI * 2);
        ctx.fillStyle = '#fefce8';
        ctx.fill();
        ctx.clip();
        ctx.fillStyle = '#050811';
        ctx.fillRect(-venR * 1.2, -venR * 1.2, venR * 2.2 * (1 - phase), venR * 2.4);
        ctx.restore();
        break;
      }

      case 'm27': {
        const dbR = Math.max(18, (target.angular_size_arcsec / 2) * pxPerArcsec * 0.85);
        const dbGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, dbR);
        dbGrad.addColorStop(0, 'rgba(167, 243, 208, 0.68)');
        dbGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.28)');
        dbGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.45);
        ctx.beginPath();
        ctx.moveTo(-dbR * 0.85, -dbR * 0.55);
        ctx.quadraticCurveTo(0, -dbR * 0.15, dbR * 0.85, -dbR * 0.55);
        ctx.lineTo(dbR * 0.85, dbR * 0.55);
        ctx.quadraticCurveTo(0, dbR * 0.15, -dbR * 0.85, dbR * 0.55);
        ctx.closePath();
        ctx.fillStyle = dbGrad;
        ctx.fill();
        ctx.restore();
        break;
      }

      case 'm81_m82':
      default: {
        const sep = Math.max(24, 900 * pxPerArcsec * 0.42);
        // M81 oval spiral
        ctx.save();
        ctx.translate(cx - sep * 0.45, cy + sep * 0.25);
        ctx.rotate(-0.4);
        const g81 = ctx.createRadialGradient(0, 0, 1, 0, 0, 26);
        g81.addColorStop(0, 'rgba(254, 243, 199, 0.88)');
        g81.addColorStop(0.5, 'rgba(203, 213, 225, 0.3)');
        g81.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.scale(1, 0.52);
        ctx.fillStyle = g81;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // M82 thin edge-on Cigar starburst
        ctx.save();
        ctx.translate(cx + sep * 0.48, cy - sep * 0.32);
        ctx.rotate(0.55);
        const g82 = ctx.createRadialGradient(0, 0, 1, 0, 0, 22);
        g82.addColorStop(0, 'rgba(241, 245, 249, 0.88)');
        g82.addColorStop(0.6, 'rgba(148, 163, 184, 0.28)');
        g82.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.scale(1, 0.22);
        ctx.fillStyle = g82;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
    }

    ctx.restore();

    // Crisp circular eyepiece field-stop ring + subtle reticle ticks
    ctx.beginPath();
    ctx.arc(cx, cy, fovRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  function renderView() {
    const target = getActiveTarget();
    const reducerActive = Boolean(state?.hasReducer ?? state?.optics?.hasReducer);
    const barlowActive = Boolean(state?.hasBarlow ?? state?.optics?.hasBarlow);
    const selectedEpMm = Number(state?.selectedEyepiece || 25);

    const matrix = computeEyepieceMatrix({
      reducerActive,
      barlowActive,
      seeingRating,
    });
    const seeingInfo = getSeeingMaxMagnification(seeingRating);
    const epItem =
      matrix.eyepieces.find((e) => e.focal_length_mm === selectedEpMm) || matrix.eyepieces[1];

    const isOptimalMatch =
      selectedEpMm === target.best_eyepiece_mm && reducerActive === Boolean(target.recommended_reducer) && !barlowActive;

    container.innerHTML = `
      <div class="safe-top pb-28 px-4 space-y-3.5">
        <!-- Back & Title Header -->
        <header class="flex items-center justify-between pt-1 gap-2">
          <button
            id="btn-fov-back"
            type="button"
            class="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-dark-surface-container-high border border-dark-outline text-xs font-bold text-dark-on-surface tap-scale"
          >
            <span class="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back</span>
          </button>

          <div class="text-center min-w-0">
            <h1 class="text-sm font-extrabold text-dark-on-surface truncate">8SE Eyepiece Simulator</h1>
            <p class="font-label text-[10px] text-accent">${matrix.configuration_label}</p>
          </div>

          <button
            id="btn-fov-auto"
            type="button"
            class="px-2.5 py-1.5 rounded-full border text-[11px] font-label font-bold tap-scale ${
              isOptimalMatch
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                : 'bg-celestron/15 border-celestron/50 text-celestron'
            }"
          >
            ${isOptimalMatch ? '✓ Best Glass' : 'Auto-Fit'}
          </button>
        </header>

        <!-- 14-Target Horizontal Selector -->
        <div class="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          ${catalog.target_list
            .map((t) => {
              const active = t.id === target.id;
              return `
              <button
                type="button"
                data-pick-target="${t.id}"
                class="shrink-0 px-3 py-1.5 rounded-full border text-xs font-bold tap-scale ${
                  active
                    ? 'bg-accent text-dark-surface border-accent'
                    : 'bg-dark-surface-container border-dark-outline text-dark-on-surface-variant'
                }"
              >
                ${t.name.split('·')[0].trim()}
              </button>
            `;
            })
            .join('')}
        </div>

        <!-- Circular Eyepiece Viewport -->
        <section class="cosmic-hero-card rounded-3xl p-4 border border-dark-outline/90 space-y-3">
          <div class="flex items-center justify-between text-[11px] font-label">
            <span class="text-dark-on-surface font-bold">${epItem.magnification_display} · ${epItem.tfov_display} FOV</span>
            <span class="${
              target.alt_deg >= 18 ? 'text-emerald-300' : target.alt_deg >= 6 ? 'text-amber-300' : 'text-slate-400'
            }">
              ${target.status_badge}
            </span>
          </div>

          <div class="mx-auto w-full max-w-[295px] aspect-square">
            <canvas id="fov-eyepiece-canvas" class="w-full h-full"></canvas>
          </div>

          ${
            epItem.exceeds_seeing_limit
              ? `<div class="bg-amber-500/15 border border-amber-400/40 rounded-2xl px-3 py-2 text-xs text-amber-200 flex items-center gap-2">
                  <span class="material-symbols-outlined text-[17px]">air</span>
                  <span>Above tonight's <strong>${seeingInfo.max_useful_mag}x</strong> seeing cap — step down eyepiece power for a sharper view!</span>
                </div>`
              : ''
          }

          <!-- Target Info & Kid Hook -->
          <div class="bg-dark-surface/75 rounded-2xl p-3 border border-dark-outline/60 space-y-1.5">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-extrabold text-dark-on-surface">${target.name}</h2>
              <span class="text-[11px] font-label text-celestron">Size ${target.angular_size_display}</span>
            </div>
            <p class="text-xs text-dark-on-surface-variant leading-relaxed">${target.how_to_spot}</p>
          </div>
        </section>

        <!-- Eyepiece & Modifier Controls -->
        <section class="glass-card rounded-3xl p-3.5 border border-dark-outline/90 space-y-2.5">
          <div class="grid grid-cols-4 gap-1.5">
            ${DEFAULT_EYEPIECES.map((ep) => {
              const active = ep.focal_length_mm === selectedEpMm;
              const calcEp = matrix.eyepieces.find((e) => e.focal_length_mm === ep.focal_length_mm);
              return `
                <button
                  type="button"
                  data-fov-ep="${ep.focal_length_mm}"
                  class="rounded-2xl py-2 px-1.5 border text-center tap-scale ${
                    active
                      ? 'bg-accent/20 border-accent text-accent'
                      : 'bg-dark-surface/75 border-dark-outline text-dark-on-surface-variant'
                  }"
                >
                  <div class="font-label text-xs font-extrabold">${ep.focal_length_mm}mm</div>
                  <div class="font-label text-[10px] opacity-85">${calcEp?.magnification_display || ''}</div>
                </button>
              `;
            }).join('')}
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button
              id="btn-fov-reducer"
              type="button"
              class="py-2 px-3 rounded-2xl border text-xs font-bold tap-scale ${
                reducerActive
                  ? 'bg-accent/20 border-accent text-accent'
                  : 'bg-dark-surface/75 border-dark-outline text-dark-on-surface-variant'
              }"
            >
              f/6.3 Wide Reducer
            </button>
            <button
              id="btn-fov-barlow"
              type="button"
              class="py-2 px-3 rounded-2xl border text-xs font-bold tap-scale ${
                barlowActive
                  ? 'bg-celestron/20 border-celestron text-celestron'
                  : 'bg-dark-surface/75 border-dark-outline text-dark-on-surface-variant'
              }"
            >
              2× Planetary Barlow
            </button>
          </div>

          <button
            id="btn-fov-log"
            type="button"
            class="w-full bg-celestron/15 hover:bg-celestron/25 border border-celestron/45 text-celestron font-extrabold text-xs py-2.5 px-4 rounded-2xl flex items-center justify-center gap-1.5 tap-scale"
          >
            <span class="material-symbols-outlined text-[17px]">bookmark_add</span>
            <span>Stamp ${target.name.split('·')[0].trim()} in Family Sky Journal</span>
          </button>
        </section>
      </div>
    `;

    const canvas = container.querySelector('#fov-eyepiece-canvas');
    drawTargetOnCanvas(canvas, target, epItem, seeingInfo.max_useful_mag);

    // Wire events
    container.querySelector('#btn-fov-back')?.addEventListener('click', () => {
      actions.navigate(returnScreen);
    });

    container.querySelector('#btn-fov-auto')?.addEventListener('click', () => {
      actions.selectEyepiece(target.best_eyepiece_mm);
      actions.toggleReducer(Boolean(target.recommended_reducer));
      actions.toggleBarlow(false);
      renderView();
    });

    container.querySelectorAll('[data-pick-target]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tid = btn.getAttribute('data-pick-target');
        const nextT = catalog.targets[tid];
        actions.selectTarget(tid);
        if (nextT) {
          actions.selectEyepiece(nextT.best_eyepiece_mm);
          actions.toggleReducer(Boolean(nextT.recommended_reducer));
          actions.toggleBarlow(false);
        }
        renderView();
      });
    });

    container.querySelectorAll('[data-fov-ep]').forEach((btn) => {
      btn.addEventListener('click', () => {
        actions.selectEyepiece(Number(btn.getAttribute('data-fov-ep')));
        renderView();
      });
    });

    container.querySelector('#btn-fov-reducer')?.addEventListener('click', () => {
      actions.toggleReducer(!reducerActive);
      if (!reducerActive && barlowActive) actions.toggleBarlow(false);
      renderView();
    });

    container.querySelector('#btn-fov-barlow')?.addEventListener('click', () => {
      actions.toggleBarlow(!barlowActive);
      if (!barlowActive && reducerActive) actions.toggleReducer(false);
      renderView();
    });

    container.querySelector('#btn-fov-log')?.addEventListener('click', () => {
      actions.navigate('logbook', {
        selectedTargetId: target.id,
        selectedEyepiece: selectedEpMm,
      });
    });
  }

  renderView();
}

export default renderFovSimulatorScreen;
