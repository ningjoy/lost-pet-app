import Button from './Button';

export default function SafetyScreen({
  onAcknowledge,
}: {
  onAcknowledge: () => void;
}) {
  return (
    <section className="flex max-w-md flex-col gap-4">
      <h2 className="text-base font-semibold">Stay safe</h2>
      <ul className="list-disc pl-5 text-sm">
        <li>Do not chase the pet.</li>
        <li>Do not yell at it.</li>
      </ul>
      <Button onClick={onAcknowledge}>I understand</Button>
    </section>
  );
}
