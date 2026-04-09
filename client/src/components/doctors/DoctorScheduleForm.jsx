import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import api from '../../utils/api';

const DAYS = [
  { value: 0, label: 'الأحد', labelEn: 'Sun' },
  { value: 1, label: 'الإثنين', labelEn: 'Mon' },
  { value: 2, label: 'الثلاثاء', labelEn: 'Tue' },
  { value: 3, label: 'الأربعاء', labelEn: 'Wed' },
  { value: 4, label: 'الخميس', labelEn: 'Thu' },
  { value: 5, label: 'الجمعة', labelEn: 'Fri' },
  { value: 6, label: 'السبت', labelEn: 'Sat' },
];

const makeDefault = () => DAYS.map(day => ({
  dayOfWeek: day.value,
  isActive: day.value >= 0 && day.value <= 4,
  morningStart: '08:00',
  morningEnd: '12:00',
  eveningStart: '16:00',
  eveningEnd: '21:00',
  morningCapacity: 20,
  eveningCapacity: 20,
}));

const DoctorScheduleForm = ({ doctor, onClose, onSave }) => {
  const [schedules, setSchedules] = useState(makeDefault());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    fetchSchedule();
  }, [doctor.id]);

  const fetchSchedule = async () => {
    try {
      const data = await api.get(`/doctors/${doctor.id}/schedule`);
      if (data && data.length > 0) {
        const merged = DAYS.map(day => {
          const existing = data.find(s => s.dayOfWeek === day.value);
          if (existing) {
            return {
              dayOfWeek: existing.dayOfWeek,
              isActive: existing.isActive,
              morningStart: existing.morningStart || '08:00',
              morningEnd: existing.morningEnd || '12:00',
              eveningStart: existing.eveningStart || '16:00',
              eveningEnd: existing.eveningEnd || '21:00',
              morningCapacity: existing.morningCapacity || 20,
              eveningCapacity: existing.eveningCapacity || 20,
            };
          }
          return makeDefault().find(s => s.dayOfWeek === day.value);
        });
        setSchedules(merged);
        // Auto-select first active day
        const firstActive = merged.find(s => s.isActive);
        if (firstActive) setSelectedDay(firstActive.dayOfWeek);
      } else {
        setSelectedDay(0);
      }
    } catch (err) {
      console.error(err);
      setSelectedDay(0);
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (dayOfWeek) => {
    setSchedules(prev =>
      prev.map(s =>
        s.dayOfWeek === dayOfWeek ? { ...s, isActive: !s.isActive } : s
      )
    );
  };

  const updateField = (dayOfWeek, field, value) => {
    setSchedules(prev =>
      prev.map(s =>
        s.dayOfWeek === dayOfWeek ? { ...s, [field]: value } : s
      )
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const activeSchedules = schedules.filter(s => s.isActive).map(s => ({
        dayOfWeek: s.dayOfWeek,
        morningStart: s.morningStart,
        morningEnd: s.morningEnd,
        eveningStart: s.eveningStart,
        eveningEnd: s.eveningEnd,
        morningCapacity: parseInt(s.morningCapacity) || 20,
        eveningCapacity: parseInt(s.eveningCapacity) || 20,
        isActive: true,
      }));

      if (activeSchedules.length === 0) {
        setError('يجب تفعيل يوم واحد على الأقل');
        return;
      }

      await api.post(`/doctors/${doctor.id}/schedule`, { schedules: activeSchedules });
      setSuccess('تم حفظ جدول العمل بنجاح ✓');
      setTimeout(() => {
        if (onSave) onSave();
      }, 1000);
    } catch (err) {
      setError(err.message || 'خطأ في حفظ الجدول');
    } finally {
      setSaving(false);
    }
  };

  const getDayLabel = (val) => DAYS.find(d => d.value === val)?.label || '';
  const selected = schedules.find(s => s.dayOfWeek === selectedDay);

  if (loading) {
    return (
      <div className="flex-center p-8">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div style={styles.alert}>{error}</div>}
      {success && <div style={styles.successAlert}>{success}</div>}

      {/* Day Selector Tabs */}
      <div style={styles.dayTabs}>
        {DAYS.map(day => {
          const sch = schedules.find(s => s.dayOfWeek === day.value);
          const isActive = sch?.isActive;
          const isSelected = selectedDay === day.value;
          return (
            <button
              type="button"
              key={day.value}
              onClick={() => setSelectedDay(day.value)}
              style={{
                ...styles.dayTab,
                ...(isSelected ? styles.dayTabSelected : {}),
                ...(isActive ? {} : styles.dayTabInactive),
                ...(isSelected && isActive ? styles.dayTabActiveSelected : {}),
                ...(isSelected && !isActive ? styles.dayTabInactiveSelected : {}),
              }}
            >
              <span style={styles.dayName}>{day.label}</span>
              <span style={{
                ...styles.dayStatus,
                color: isActive ? '#16a34a' : '#94a3b8',
              }}>
                {isActive ? '✓' : '✕'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Day Details */}
      {selected && (
        <div style={styles.dayPanel}>
          {/* Toggle + Day Name */}
          <div style={styles.dayHeader}>
            <h3 style={styles.dayTitle}>{getDayLabel(selectedDay)}</h3>
            <label style={styles.toggleLabel}>
              <span style={{ marginLeft: '0.5rem', fontSize: '0.9rem' }}>
                {selected.isActive ? 'يوم عمل' : 'عطلة'}
              </span>
              <div
                onClick={() => toggleDay(selectedDay)}
                style={{
                  ...styles.toggle,
                  backgroundColor: selected.isActive ? '#0ea5e9' : '#cbd5e1',
                }}
              >
                <div style={{
                  ...styles.toggleDot,
                  transform: selected.isActive ? 'translateX(-18px)' : 'translateX(0)',
                }}></div>
              </div>
            </label>
          </div>

          {selected.isActive ? (
            <div style={styles.shiftsContainer}>
              {/* Morning Shift */}
              <div style={styles.shiftCard}>
                <div style={styles.shiftHeader}>
                  <span style={styles.sunIcon}>☀️</span>
                  <h4 style={styles.shiftTitle}>الفترة الصباحية</h4>
                </div>
                <div style={styles.fieldRow}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>بداية الدوام</label>
                    <input
                      type="time"
                      value={selected.morningStart}
                      onChange={(e) => updateField(selectedDay, 'morningStart', e.target.value)}
                      style={styles.input}
                      dir="ltr"
                    />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>نهاية الدوام</label>
                    <input
                      type="time"
                      value={selected.morningEnd}
                      onChange={(e) => updateField(selectedDay, 'morningEnd', e.target.value)}
                      style={styles.input}
                      dir="ltr"
                    />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>عدد المرضى</label>
                    <input
                      type="number"
                      value={selected.morningCapacity}
                      onChange={(e) => updateField(selectedDay, 'morningCapacity', e.target.value)}
                      style={styles.input}
                      min="1" max="100" dir="ltr"
                    />
                  </div>
                </div>
              </div>

              {/* Evening Shift */}
              <div style={{ ...styles.shiftCard, ...styles.shiftCardEvening }}>
                <div style={styles.shiftHeader}>
                  <span style={styles.moonIcon}>🌙</span>
                  <h4 style={styles.shiftTitle}>الفترة المسائية</h4>
                </div>
                <div style={styles.fieldRow}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>بداية الدوام</label>
                    <input
                      type="time"
                      value={selected.eveningStart}
                      onChange={(e) => updateField(selectedDay, 'eveningStart', e.target.value)}
                      style={styles.input}
                      dir="ltr"
                    />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>نهاية الدوام</label>
                    <input
                      type="time"
                      value={selected.eveningEnd}
                      onChange={(e) => updateField(selectedDay, 'eveningEnd', e.target.value)}
                      style={styles.input}
                      dir="ltr"
                    />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>عدد المرضى</label>
                    <input
                      type="number"
                      value={selected.eveningCapacity}
                      onChange={(e) => updateField(selectedDay, 'eveningCapacity', e.target.value)}
                      style={styles.input}
                      min="1" max="100" dir="ltr"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={styles.offDay}>
              <span style={{ fontSize: '2.5rem' }}>🏖️</span>
              <p style={{ color: '#94a3b8', fontSize: '1rem', marginTop: '0.5rem' }}>هذا اليوم عطلة - لن يتم قبول حجوزات</p>
              <button
                type="button"
                onClick={() => toggleDay(selectedDay)}
                style={styles.activateBtn}
              >
                تفعيل كيوم عمل
              </button>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div style={styles.summary}>
        <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>ملخص: </span>
        {schedules.filter(s => s.isActive).map(s => (
          <span key={s.dayOfWeek} style={styles.summaryBadge}>
            {getDayLabel(s.dayOfWeek)}
          </span>
        ))}
        {schedules.filter(s => s.isActive).length === 0 && (
          <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>لا يوجد أيام عمل مفعلة!</span>
        )}
      </div>

      <div className="modal-footer" style={{ marginTop: '0.75rem', marginLeft: '-1.5rem', marginRight: '-1.5rem', marginBottom: '-1.5rem' }}>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>إلغاء</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'جاري الحفظ...' : <><Save size={18} /> حفظ الجدول</>}
        </button>
      </div>
    </form>
  );
};

const styles = {
  alert: {
    padding: '0.75rem 1rem',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    borderRadius: '0.5rem',
    border: '1px solid #fecaca',
    marginBottom: '1rem',
    fontSize: '0.9rem',
  },
  successAlert: {
    padding: '0.75rem 1rem',
    backgroundColor: '#f0fdf4',
    color: '#16a34a',
    borderRadius: '0.5rem',
    border: '1px solid #bbf7d0',
    marginBottom: '1rem',
    fontSize: '0.9rem',
  },
  dayTabs: {
    display: 'flex',
    gap: '0.35rem',
    marginBottom: '1rem',
    padding: '0.25rem',
    backgroundColor: 'var(--gray-100)',
    borderRadius: '0.75rem',
    overflowX: 'auto',
  },
  dayTab: {
    flex: 1,
    padding: '0.6rem 0.25rem',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.15rem',
    transition: 'all 0.2s',
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
    minWidth: '60px',
  },
  dayTabSelected: {
    backgroundColor: 'white',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  dayTabInactive: {
    opacity: 0.5,
  },
  dayTabActiveSelected: {
    backgroundColor: '#e0f2fe',
    boxShadow: '0 1px 3px rgba(14,165,233,0.2)',
  },
  dayTabInactiveSelected: {
    backgroundColor: '#f1f5f9',
    opacity: 1,
  },
  dayName: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--text-main)',
  },
  dayStatus: {
    fontSize: '0.7rem',
    fontWeight: 800,
  },
  dayPanel: {
    border: '1px solid var(--border-color)',
    borderRadius: '0.75rem',
    overflow: 'hidden',
    marginBottom: '0.75rem',
  },
  dayHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--gray-50)',
    borderBottom: '1px solid var(--border-color)',
  },
  dayTitle: {
    fontWeight: 700,
    fontSize: '1.1rem',
    color: 'var(--text-main)',
    margin: 0,
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    userSelect: 'none',
  },
  toggle: {
    width: '40px',
    height: '22px',
    borderRadius: '11px',
    position: 'relative',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  toggleDot: {
    width: '18px',
    height: '18px',
    backgroundColor: 'white',
    borderRadius: '50%',
    position: 'absolute',
    top: '2px',
    right: '2px',
    transition: 'transform 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
  shiftsContainer: {
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  shiftCard: {
    padding: '1rem',
    borderRadius: '0.75rem',
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
  },
  shiftCardEvening: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  shiftHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  shiftTitle: {
    fontWeight: 700,
    fontSize: '0.95rem',
    margin: 0,
    color: 'var(--text-main)',
  },
  sunIcon: { fontSize: '1.2rem' },
  moonIcon: { fontSize: '1.2rem' },
  fieldRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '0.75rem',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  input: {
    padding: '0.55rem 0.75rem',
    border: '1px solid var(--border-color)',
    borderRadius: '0.5rem',
    backgroundColor: 'white',
    color: 'var(--text-main)',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
    outline: 'none',
  },
  offDay: {
    padding: '2.5rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  activateBtn: {
    marginTop: '1rem',
    padding: '0.5rem 1.25rem',
    backgroundColor: '#0ea5e9',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
    fontFamily: 'inherit',
  },
  summary: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    flexWrap: 'wrap',
    padding: '0.5rem 0',
  },
  summaryBadge: {
    padding: '0.2rem 0.5rem',
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
};

export default DoctorScheduleForm;
