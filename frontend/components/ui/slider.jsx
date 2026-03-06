import React from "react";

export function Slider({ min = 0, max = 100, value = 0, onChange, onValueChange, className = "", ...props }) {
  // Handle both single value and array value
  const sliderValue = Array.isArray(value) ? value[0] : value;
  
  const handleChange = (e) => {
    const newValue = Number(e.target.value);
    if (onChange) {
      onChange(newValue);
    }
    if (onValueChange) {
      onValueChange([newValue]);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <input
        type="range"
        min={min}
        max={max}
        value={sliderValue}
        onChange={handleChange}
        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
        {...props}
      />
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: #60a5fa;
          cursor: pointer;
          border-radius: 50%;
        }
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #60a5fa;
          cursor: pointer;
          border-radius: 50%;
          border: none;
        }
      `}</style>
    </div>
  );
}