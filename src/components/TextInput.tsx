import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export default function TextInput({ label, ...props }: TextInputProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        className="rounded border border-gray-300 px-3 py-2 text-sm"
        {...props}
      />
    </div>
  );
}
