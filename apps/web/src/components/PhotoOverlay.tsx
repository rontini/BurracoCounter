import type { BoundingBox } from '@burracount/rules';
import { useEffect, useMemo } from 'react';
import { t } from '../i18n';

export interface OverlayBox {
  bbox: BoundingBox;
  label: string;
  /** ok, low (bassa sicurezza), selected, fixed (corretta a mano), hand (carta in mano). */
  tone: 'ok' | 'low' | 'selected' | 'fixed' | 'hand';
}

/** Foto con i riquadri dei rilevamenti sovrapposti, nelle coordinate dell'originale. */
export function PhotoOverlay({
  photo,
  size,
  boxes,
}: {
  photo: Blob;
  size: { width: number; height: number } | null;
  boxes: OverlayBox[];
}) {
  const url = useMemo(() => URL.createObjectURL(photo), [photo]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const long = size ? Math.max(size.width, size.height) : 0;
  return (
    <div className="photo-frame">
      <img src={url} alt={t('photo.alt')} />
      {size && (
        <svg
          className="overlay"
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {boxes.map((b, i) => (
            <g key={i} className={`box ${b.tone === 'ok' ? '' : b.tone}`}>
              <rect
                x={b.bbox.x}
                y={b.bbox.y}
                width={b.bbox.width}
                height={b.bbox.height}
                strokeWidth={long / 300}
              />
              <text x={b.bbox.x} y={b.bbox.y - size.height / 150} fontSize={long / 40}>
                {b.label}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
