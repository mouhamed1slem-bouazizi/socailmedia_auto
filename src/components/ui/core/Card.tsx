type CardProps = {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
};

export function Card({ children, className = '', header, footer }: CardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {header && <div className="px-6 py-4 border-b">{header}</div>}
      <div className="p-6">{children}</div>
      {footer && <div className="px-6 py-4 border-t bg-gray-50">{footer}</div>}
    </div>
  );
}