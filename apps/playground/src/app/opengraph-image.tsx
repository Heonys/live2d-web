import { ImageResponse } from 'next/og'

import { siteUrl } from '../lib/siteOrigin'

export const alt = 'live2d-web · A Live2D runtime for the web'
export const contentType = 'image/png'
export const size = {
  height: 630,
  width: 1200,
}

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0b0c0f',
          color: '#f5f5f6',
          display: 'flex',
          height: '100%',
          padding: '68px 76px',
          position: 'relative',
          width: '100%',
        }}
      >
        <div
          style={{
            border: '1px solid #2a2e36',
            display: 'flex',
            inset: '28px',
            position: 'absolute',
          }}
        />
        <div
          style={{
            background: '#ff718f',
            display: 'flex',
            height: '6px',
            left: '28px',
            position: 'absolute',
            top: '28px',
            width: '132px',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div
            style={{
              alignItems: 'center',
              display: 'flex',
              fontSize: '30px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            {/* ImageResponse renders remote assets directly into the generated card. */}
            <img
              alt=""
              height="48"
              src={siteUrl('/brand/live2d-web-avatar.png')}
              style={{
                border: '1px solid #343942',
                borderRadius: '50%',
                height: '48px',
                marginRight: '18px',
                objectFit: 'cover',
                width: '48px',
              }}
              width="48"
            />
            live2d-web
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                fontSize: '76px',
                fontWeight: 700,
                letterSpacing: '-0.045em',
                lineHeight: 1.04,
                maxWidth: '920px',
              }}
            >
              A Live2D runtime for the web.
            </div>
            <div
              style={{
                color: '#b9bdc6',
                display: 'flex',
                fontSize: '28px',
                marginTop: '26px',
              }}
            >
              Cubism 4/5 · WebGL2 · JavaScript + React
            </div>
          </div>

          <div
            style={{
              alignItems: 'center',
              color: '#868c96',
              display: 'flex',
              fontSize: '22px',
              justifyContent: 'space-between',
            }}
          >
            <span>Motion · Lip sync · Face tracking · Devtools</span>
            <span>live2d-web.heonys.dev</span>
          </div>
        </div>
      </div>
    ),
    size,
  )
}
