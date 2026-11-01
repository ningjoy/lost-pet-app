import { Link } from 'react-router-dom';

type PageHeaderProps = {
  title: string;
  backTo?: string;
};

export default function PageHeader({ title, backTo }: PageHeaderProps) {
  return (
    <header className="mb-4 flex items-center gap-3 border-b border-gray-200 pb-3">
      {backTo && (
        <Link to={backTo} aria-label="Back" className="text-lg">
          ←
        </Link>
      )}
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}
