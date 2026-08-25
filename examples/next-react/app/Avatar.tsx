'use client'

import { Live2DCanvas, Live2DModel } from 'live2d-web/react'

export function Avatar() {
  return (
    <div className="avatar">
      <Live2DCanvas coreUrl="/live2dcubismcore.min.js">
        <Live2DModel src="/models/model.model3.json" />
      </Live2DCanvas>
    </div>
  )
}
