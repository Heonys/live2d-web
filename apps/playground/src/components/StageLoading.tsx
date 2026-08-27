/**
 * One loading state for the whole demo. The runtime reports its internal
 * stages (core, stage, model), but a visitor has no use for them: they are all
 * "the character is not here yet".
 */
export function StageLoading() {
  return (
    <div className="stage-loading" role="status">
      <div className="stage-loading-mark" aria-hidden="true">
        <img alt="" decoding="async" height="82" src="/brand/model-loader.webp" width="82" />
        <svg className="stage-loading-rig" viewBox="0 0 120 120">
          <g>
            <path className="stage-loading-curve" d="M15 72C20 27 87 14 105 54C115 78 94 106 60 105" />
            <path d="M15 72L31 34M105 54L91 91" />
            <circle cx="15" cy="72" r="3.5" />
            <circle cx="31" cy="34" r="3.5" />
            <circle cx="105" cy="54" r="3.5" />
          </g>
        </svg>
      </div>
      <p className="stage-loading-label">Preparing model</p>
    </div>
  )
}
