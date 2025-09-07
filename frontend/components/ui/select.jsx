import React from "react";

export function Select({ children, value, onValueChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className="w-full h-10 px-3 py-2 text-sm bg-gray-100 text-gray-900 border border-gray-700 rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-blue-600"
      >
        {children}
      </select>
    </div>
  );
}

export function SelectTrigger({ children, className = "" }) {
  return <div className={`bg-gray-100 text-gray-900 border border-gray-700 rounded-md px-3 py-2 ${className}`}>{children}</div>;
}

export function SelectContent({ children }) {
  return <div className="mt-1 bg-gray-50 border border-gray-700 rounded-md p-1 shadow-lg">{children}</div>;
}

export function SelectItem({ children, value }) {
  return (
    <option value={value} className="px-2 py-1.5 text-sm rounded-sm cursor-default bg-gray-100 text-gray-900 hover:bg-blue-100">
      {children}
    </option>
  );
}
