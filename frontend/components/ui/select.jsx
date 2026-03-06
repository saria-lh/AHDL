import React, { useState } from "react";

export function Select({ children, value, onValueChange, className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className={`relative ${className}`}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-10 px-3 py-2 text-sm bg-gray-700/80 border border-gray-600/50 text-white rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer flex items-center justify-between"
      >
        {value}
        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600/50 rounded-md shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}

export function SelectTrigger({ children, className = "" }) {
  return <div className={`bg-gray-700/80 border border-gray-600/50 text-white rounded-md px-3 py-2 ${className}`}>{children}</div>;
}

export function SelectContent({ children }) {
  return <div className="bg-gray-800 border border-gray-600/50 rounded-md p-1 shadow-lg">{children}</div>;
}

export function SelectItem({ children, value, onClick }) {
  return (
    <div 
      onClick={() => onClick && onClick(value)}
      className="px-2 py-1.5 text-sm rounded-sm cursor-default text-white hover:bg-gray-700"
    >
      {children}
    </div>
  );
}
