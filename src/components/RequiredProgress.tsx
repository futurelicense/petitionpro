import { requiredProgress } from "@/lib/case-visuals";
import { milestoneState, type ClientCase } from "@/lib/cases";

export function RequiredProgress({ matter, compact = false }: { matter: ClientCase; compact?: boolean }) {
  const progress = requiredProgress(matter);
  if (!progress.total) return <p className="small">Choose a pathway to track required completion.</p>;
  return (
    <section className={`required-progress${compact ? " compact" : ""}`} aria-label="Required milestone completion">
      <div className="required-head">
        <div>
          {!compact && <p className="kicker ink">Required evidence</p>}
          <p className="required-count"><strong>{progress.complete}</strong> of {progress.total} complete</p>
          {!compact && <p className="small">{progress.total - progress.complete} remaining for the active pathway</p>}
        </div>
        <strong className="required-percent">{progress.percent}<span>%</span></strong>
      </div>
      <div className="required-bar" role="progressbar" aria-label="Required milestones complete"
        aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.complete}
        aria-valuetext={`${progress.complete} of ${progress.total} complete; ${progress.partial} in progress`}>
        <span style={{ width: `${progress.percent}%` }} />
      </div>
      {!compact && (
        <>
          <div className="required-segments" aria-label="Status of each required milestone">
            {progress.items.map((item) => (
              <span key={item.id} data-state={milestoneState(item)} role="img"
                aria-label={`${item.name}: ${milestoneState(item) === "in-file" ? "complete" : milestoneState(item) === "partial" ? "in progress" : "missing"}`}
                title={`${item.name}: ${milestoneState(item) === "in-file" ? "Complete" : milestoneState(item) === "partial" ? "In progress" : "Missing"}`} />
            ))}
          </div>
          <div className="progress-legend">
            <span data-state="in-file">{progress.complete} complete</span>
            <span data-state="partial">{progress.partial} in progress</span>
            <span data-state="missing">{progress.missing} missing</span>
          </div>
        </>
      )}
    </section>
  );
}
