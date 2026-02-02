"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CustomSelect({
  value,
  options,
  onChange,
  placeholder = "Select...",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const DROPDOWN_MAX_HEIGHT = 240;
  const DROPDOWN_GAP = 4;

  const [dropdownRect, setDropdownRect] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const getDropdownPosition = () => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - DROPDOWN_GAP;
    const spaceAbove = rect.top - DROPDOWN_GAP;
    // Open upward when there's more space above than below, or not enough space below
    const openUp = spaceAbove >= spaceBelow;

    const left = Math.max(0, Math.min(rect.left, window.innerWidth - rect.width));
    const width = Math.min(rect.width, window.innerWidth - left);

    if (openUp) {
      return {
        bottom: window.innerHeight - rect.top + DROPDOWN_GAP,
        left,
        width,
        maxHeight: Math.min(DROPDOWN_MAX_HEIGHT, Math.max(80, spaceAbove)),
      };
    }
    return {
      top: rect.bottom + DROPDOWN_GAP,
      left,
      width,
      maxHeight: Math.min(DROPDOWN_MAX_HEIGHT, Math.max(80, spaceBelow)),
    };
  };

  // Position overlay from trigger; flip open upward when not enough space below
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const update = () => setDropdownRect(getDropdownPosition());
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen]);

  // Close dropdown when clicking outside (trigger or portal dropdown)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        listRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
      setFocusedIndex(-1);
      setDropdownRect(null);
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Scroll focused item into view
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("li");
      items[focusedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(options.findIndex((opt) => opt.value === value));
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < options.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0) {
          onChange(options[focusedIndex].value);
          setIsOpen(false);
          setFocusedIndex(-1);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
      case "Tab":
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
    }
  };

  const handleOptionClick = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setFocusedIndex(-1);
    setDropdownRect(null);
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%" }}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => {
          if (!isOpen && containerRef.current) {
            setDropdownRect(getDropdownPosition());
            setFocusedIndex(options.findIndex((opt) => opt.value === value));
          } else if (isOpen) {
            setDropdownRect(null);
          }
          setIsOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          padding: "10px 12px",
          backgroundColor: "#ffffff",
          border: "1px solid #dddddd",
          borderRadius: "6px",
          fontSize: "14px",
          color: selectedOption ? "#1d1c1d" : "#868686",
          cursor: "pointer",
          outline: "none",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          textAlign: "left",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "#1264a3";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(18, 100, 163, 0.1)";
        }}
        onBlur={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = "#dddddd";
            e.currentTarget.style.boxShadow = "none";
          }
        }}
      >
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selectedOption?.label ?? placeholder}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#616061"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            flexShrink: 0,
            transition: "transform 0.2s ease",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown overlay via portal - appears on top of filters and tickets */}
      {isOpen &&
        dropdownRect &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            ref={listRef}
            role="listbox"
            style={{
              position: "fixed",
              ...(dropdownRect.top !== undefined
                ? { top: dropdownRect.top }
                : { bottom: dropdownRect.bottom }),
              left: dropdownRect.left,
              width: dropdownRect.width,
              margin: 0,
              maxHeight: dropdownRect.maxHeight,
              overflowY: "auto",
              padding: "4px 0",
              listStyle: "none",
              backgroundColor: "#ffffff",
              border: "1px solid #e8e8e8",
              borderRadius: "8px",
              boxShadow:
                "0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)",
              zIndex: 1100,
            }}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isFocused = index === focusedIndex;

              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleOptionClick(option.value)}
                  onMouseEnter={() => setFocusedIndex(index)}
                  style={{
                    padding: "10px 12px",
                    fontSize: "14px",
                    color: "#1d1c1d",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: isFocused
                      ? "#f0f4f8"
                      : isSelected
                      ? "#f8f8f8"
                      : "transparent",
                    transition: "background-color 0.1s ease",
                  }}
                >
                  <span>{option.label}</span>
                  {isSelected && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#1264a3"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </div>
  );
}
