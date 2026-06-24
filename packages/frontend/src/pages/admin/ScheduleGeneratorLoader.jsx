import React, { useEffect, useState } from 'react';
import './ScheduleGeneratorLoader.css';

const ScheduleGeneratorLoader = ({ 
  message, 
  progress, 
  showProgress = true, // Default to true for backward compatibility
  isOverlay = true     // Default to true (full screen)
}) => {
  const totalCells = 35;
  
  // Function to create a random array of booleans for cell highlights.
  const generateHighlightArray = () => {
    return Array.from({ length: totalCells }, () => Math.random() > 0.8);
  };

  // Store the highlighted state for each cell in state.
  const [highlightedCells, setHighlightedCells] = useState(generateHighlightArray());

  // Update the highlighted cells every 4 seconds.
  useEffect(() => {
    const interval = setInterval(() => {
      setHighlightedCells(generateHighlightArray());
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Create cells based on highlightedCells state.
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const isHighlight = highlightedCells[i];
    return (
      <div 
        key={i} 
        className={`calendar-cell ${isHighlight ? 'highlight' : ''}`} 
        style={{ '--index': i }}
      ></div>
    );
  });

  // Create rings for the calendar.
  const rings = Array.from({ length: 5 }, (_, i) => (
    <div key={i} className="ring"></div>
  ));

  // Determine container style based on isOverlay prop
  const containerClass = isOverlay ? "loading-overlay" : "embedded-loader";
  const containerStyle = isOverlay ? {} : {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    padding: '20px'
  };

  return (
    <div className={containerClass} style={containerStyle}>
      <div className="schedule-generator-wrapper">
        <div className="calendar-loader">
          <div className="calendar-rings">
            {rings}
          </div>
          <div className="calendar-base">
            <div className="calendar-header">
              <div className="calendar-month">OptiSched</div>
            </div>
            <div className="calendar-grid">
              {cells}
            </div>
          </div>
        </div>
        <div className="generating-text" style={{ marginTop: '20px', textAlign: 'center' }}>
          {message}
        </div>
        
        {showProgress && (
          <>
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="progress-text">{progress}% Complete</div>
          </>
        )}
      </div>
    </div>
  );
};

export default ScheduleGeneratorLoader;