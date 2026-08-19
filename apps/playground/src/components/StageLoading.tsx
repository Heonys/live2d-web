/**
 * One loading state for the whole demo. The runtime reports its internal
 * stages (core, stage, model), but a visitor has no use for them: they are all
 * "the character is not here yet".
 */
export function StageLoading() {
  return (
    <div className="stage-loading" role="status">
      <div className="stage-loading-spinner" aria-hidden="true" />
      <p className="stage-loading-label">Loading the model</p>
    </div>
  )
}
