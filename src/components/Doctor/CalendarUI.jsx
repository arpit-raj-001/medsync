import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './CalendarUI.css';

const CalendarUI = ({ selectedDate, onDateSelect, appointmentCounts = {} }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthName = currentMonth.toLocaleString('default', { month: 'long' });

  const totalDays = daysInMonth(year, month);
  const startOffset = firstDayOfMonth(year, month);

  const days = [];
  // Padding for start of month
  for (let i = 0; i < startOffset; i++) {
    days.push(<div key={`pad-${i}`} className="cal-day pad" />);
  }

  // Actual days
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isSelected = selectedDate === dateStr;
    const count = appointmentCounts[dateStr] || 0;

    days.push(
      <div 
        key={d} 
        className={`cal-day ${isSelected ? 'selected' : ''} ${count > 0 ? 'has-events' : ''}`}
        onClick={() => onDateSelect(dateStr)}
      >
        <span className="day-num">{d}</span>
        {count > 0 && (
          <div className="event-indicator">
            <div className="dot" />
            <span className="count">{count}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="cal-ui-wrapper">
      <div className="cal-header">
        <button onClick={prevMonth} className="cal-nav-btn"><ChevronLeft size={20} /></button>
        <h3>{monthName} {year}</h3>
        <button onClick={nextMonth} className="cal-nav-btn"><ChevronRight size={20} /></button>
      </div>

      <div className="cal-weekdays">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <span key={d}>{d}</span>)}
      </div>

      <div className="cal-grid">
        {days}
      </div>
    </div>
  );
};

export default CalendarUI;
