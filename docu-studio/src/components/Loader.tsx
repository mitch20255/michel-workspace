const STEPS = [
  "Analyse du sujet…",
  "Rédaction du sommaire expert…",
  "Écriture du scénario…",
  "Découpage en scènes…",
  "Préparation du documentaire…",
];

export function Loader({ step }: { step: number }) {
  return (
    <div className="loader">
      <div className="loader-orbit">
        <div className="loader-core" />
      </div>
      <ul className="loader-steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={
              i < step ? "done" : i === step ? "active" : "pending"
            }
          >
            <span className="dot" />
            {label}
          </li>
        ))}
      </ul>
      <p className="loader-hint">
        La génération peut prendre de 20 à 60 secondes selon le modèle.
      </p>
    </div>
  );
}
