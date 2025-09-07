import React from "react";

export function Input({ className = "", ...props }) {
  return (
    <input
      className={`block w-full h-10 px-3 py-2 border border-gray-700 bg-gray-100 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder-gray-500 ${className}`}
      {...props}
    />
  );
}
