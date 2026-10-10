import type { InputHTMLAttributes, ReactNode } from "react";
import styles from "./Field.module.css";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label: string;
  helpText?: string;
  error?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export function Field({ label, helpText, error, prefix, suffix, className, ...rest }: FieldProps) {
  return (
    <label className={`${styles.field} ${className ?? ""}`}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.inputWrap} ${error ? styles.errorWrap : ""}`}>
        {prefix && <span className={styles.affix}>{prefix}</span>}
        <input className={styles.input} {...rest} />
        {suffix && <span className={styles.affix}>{suffix}</span>}
      </span>
      {(error ?? helpText) && <span className={error ? styles.errorText : styles.helpText}>{error ?? helpText}</span>}
    </label>
  );
}
