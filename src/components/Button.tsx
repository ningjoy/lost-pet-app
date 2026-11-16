import type { ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

export default function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  const styles =
    variant === 'primary'
      ? 'bg-black text-white'
      : 'border border-gray-300 bg-white text-black';
  return (
    <button
      className={`rounded px-4 py-3 text-sm font-semibold disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}
