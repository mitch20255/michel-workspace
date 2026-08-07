import type { Production } from "../types";

/** Rendu Markdown minimal (##, -, **gras**) — sans dépendance externe. */
function renderMarkdown(md: string): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\\\*/g, "*");

  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }
    if (line.startsWith("## ")) {
      closeList();
      out.push(`<h3>${inline(line.slice(3))}</h3>`);
    } else if (line.startsWith("# ")) {
      closeList();
      out.push(`<h2>${inline(line.slice(2))}</h2>`);
    } else if (/^[-*] /.test(line.trim())) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(line.trim().slice(2))}</li>`);
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("");
}

interface Props {
  production: Production;
  onPlay: () => void;
  onReset: () => void;
}

export function SummaryView({ production, onPlay, onReset }: Props) {
  const { title, subtitle, expertSummary, keyPoints, notes, documentary } =
    production;

  return (
    <div className="summary">
      <div className="summary-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="sub">{subtitle}</p>}
        </div>
        <div className="summary-cta">
          <button className="primary" onClick={onPlay}>
            ▶ Lancer le documentaire
          </button>
          <button className="ghost" onClick={onReset}>
            Nouveau
          </button>
        </div>
      </div>

      <div className="summary-grid">
        <article
          className="prose"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(expertSummary) }}
        />
        <aside className="aside">
          <h4>Points clés</h4>
          <ul className="keypoints">
            {keyPoints.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
          <div className="meta">
            <span>
              {documentary.scenes.length} scènes ·{" "}
              {documentary.totalDurationSec}s ·{" "}
              {documentary.style === "realistic" ? "réaliste" : "animé"}
            </span>
          </div>
          {notes && (
            <div className="notes">
              <h4>À nuancer</h4>
              <p>{notes}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
