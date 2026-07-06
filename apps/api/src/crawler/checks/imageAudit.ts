import type { Page } from 'playwright';
import type { RawFinding, Viewport } from '@bugfinder/shared';
import type { PageCapture } from './networkListeners.js';

interface DomImage {
  src: string;
  naturalWidth: number;
  complete: boolean;
  alt: string;
  selector: string;
}

/**
 * Detects broken images: naturalWidth === 0 on a loaded <img>, or an image
 * resource that returned a non-200 status.
 */
export async function imageAudit(
  page: Page,
  capture: PageCapture,
  viewport: Viewport,
): Promise<RawFinding[]> {
  const images: DomImage[] = await page
    .$$eval('img', (nodes) =>
      nodes.map((img, i) => ({
        src: (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || '',
        naturalWidth: (img as HTMLImageElement).naturalWidth,
        complete: (img as HTMLImageElement).complete,
        alt: (img as HTMLImageElement).alt || '',
        selector: (img as HTMLImageElement).id
          ? `#${(img as HTMLImageElement).id}`
          : `img:nth-of-type(${i + 1})`,
      })),
    )
    .catch(() => [] as DomImage[]);

  const findings: RawFinding[] = [];
  const seen = new Set<string>();

  for (const img of images) {
    if (!img.src || img.src.startsWith('data:')) continue;
    const status = capture.statusByUrl.get(img.src);
    const isBrokenDom = img.complete && img.naturalWidth === 0;
    const isBadStatus = status !== undefined && status >= 400;
    if (!isBrokenDom && !isBadStatus) continue;
    if (seen.has(img.src)) continue;
    seen.add(img.src);

    findings.push({
      type: 'broken-image',
      message: `Broken image (${isBadStatus ? `HTTP ${status}` : 'naturalWidth=0'}): ${img.src}`,
      viewport,
      evidence: {
        resourceUrl: img.src,
        selector: img.selector,
        alt: img.alt,
        naturalWidth: img.naturalWidth,
        statusCode: status ?? null,
      },
    });
  }

  return findings;
}
