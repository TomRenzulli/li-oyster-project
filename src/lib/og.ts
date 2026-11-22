import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

/**
 * Build-time Open Graph images.
 *
 * Satori takes a plain element tree (no JSX needed) and renders SVG; resvg
 * turns that into PNG, because the social crawlers do not render SVG
 * reliably. The display face is EB Garamond, installed from @fontsource so the
 * font is an auditable npm dependency under the SIL Open Font License rather
 * than a binary committed to the repo or a build-time download.
 */

const require = createRequire(import.meta.url);

const loadFont = async (weight: 400 | 600) =>
  readFile(
    require.resolve(`@fontsource/eb-garamond/files/eb-garamond-latin-${weight}-normal.woff`),
  );

let fonts: Awaited<ReturnType<typeof buildFonts>> | undefined;

async function buildFonts() {
  const [regular, semibold] = await Promise.all([loadFont(400), loadFont(600)]);
  return [
    { name: 'EB Garamond', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'EB Garamond', data: semibold, weight: 600 as const, style: 'normal' as const },
  ];
}

const NAVY = '#16232f';
const SALT = '#f7f6f1';
const BRASS = '#c79f4b';
const SHELL = '#b6c6d6';

export interface OgOptions {
  /**
   * Astro's GetStaticPaths requires props to carry an index signature, so this
   * interface declares one rather than the route file casting around the type.
   */
  [key: string]: string | undefined;
  title: string;
  /** Short line under the title: a place, a count, a label. */
  subtitle?: string;
  /** Small label above the title, e.g. "Oyster farm". */
  eyebrow?: string;
}

export async function renderOgImage({ title, subtitle, eyebrow }: OgOptions): Promise<Uint8Array> {
  fonts ??= await buildFonts();

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          // Satori sizes this box content-box: the padding is ADDED to the
          // height rather than contained by it. So the inner height is the
          // canvas height minus the vertical padding (630 - 56 - 44 = 530),
          // which keeps the footer rule on the canvas instead of 100px below it.
          width: '1056px',
          height: '530px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: NAVY,
          padding: '56px 72px 44px',
          fontFamily: 'EB Garamond',
        },
        children: [
          // Eyebrow: fixed band at the top.
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                height: '44px',
                color: BRASS,
                fontSize: '26px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              },
              children: eyebrow ?? '',
            },
          },
          // Title block: takes the remaining space and centres within it.
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                flexGrow: 1,
                justifyContent: 'center',
                // Without an explicit width Satori will not wrap the headline,
                // and a long farm name runs off the right edge.
                width: '1056px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      width: '1056px',
                      color: SALT,
                      fontSize: title.length > 44 ? '62px' : '78px',
                      fontWeight: 600,
                      lineHeight: 1.12,
                    },
                    children: title,
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      width: '1056px',
                      color: SHELL,
                      fontSize: '32px',
                      marginTop: '18px',
                      lineHeight: 1.35,
                    },
                    children: subtitle ?? '',
                  },
                },
              ],
            },
          },
          // Footer: fixed height and no shrinking, so a tall headline cannot
          // push it off the canvas.
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                width: '1056px',
                height: '44px',
                flexShrink: 0,
                borderTop: `4px solid ${BRASS}`,
                paddingTop: '20px',
                color: SALT,
                fontSize: '30px',
              },
              children: 'longislandoysterfarm.com',
            },
          },
        ],
      },
    },
    { width: 1200, height: 630, fonts },
  );

  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
