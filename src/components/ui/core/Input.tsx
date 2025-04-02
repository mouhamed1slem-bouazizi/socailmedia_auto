type InputProps = {
  label?: string;
  error?: string;
  helper?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ 
  label, 
  error, 
  helper, 
  className = '', 
  ...props 
}: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-3 py-2 border rounded-md shadow-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500
          ${error ? 'border-red-500' : 'border-gray-300'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {helper && <p className="text-sm text-gray-500">{helper}</p>}
    </div>
  );
}