import styles from "./Slider.module.css";

interface SliderProps {
  label: string;
  helpText?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}

export function Slider({ label, helpText, value, min, max, step = 1, onChange, formatValue }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{formatValue ? formatValue(value) : value}</span>
      </div>
      <input
        type="range"
        className={styles.input}
        style={{ ["--fill-pct" as string]: `${pct}%` }}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className={styles.rangeLabels}>
        <span>{formatValue ? formatValue(min) : min}</span>
        <span>{formatValue ? formatValue(max) : max}</span>
      </div>
      {helpText && <p className={styles.help}>{helpText}</p>}
    </div>
  );
}
