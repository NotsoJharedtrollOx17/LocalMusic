export default function EqualizerSwitch({
  label,
  enabled,
  disabled,
  onChange,
}: {
  label: string;
  enabled: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label className="sound-eq-switch">
      <input
        type="checkbox"
        role="switch"
        checked={enabled}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="sound-switch-track" aria-hidden="true">
        <span />
      </span>
      <span>{label}</span>
    </label>
  );
}
