const { format, addDays, parseISO, isToday, isBefore, startOfDay } = require('date-fns');

function generateFileNumber() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `P${year}${month}${random}`;
}

function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${year}${month}${day}-${random}`;
}

function formatDate(date) {
  return format(new Date(date), 'yyyy-MM-dd');
}

function getDayOfWeek(date) {
  return new Date(date).getDay();
}

function calculateFollowUpDate(visitDate, daysAfter) {
  return format(addDays(new Date(visitDate), daysAfter), 'yyyy-MM-dd');
}

function calculateReminderDate(followUpDate) {
  return format(addDays(parseISO(followUpDate), -1), 'yyyy-MM-dd');
}

function isDateToday(dateStr) {
  return isToday(parseISO(dateStr));
}

function isDatePast(dateStr) {
  return isBefore(parseISO(dateStr), startOfDay(new Date()));
}

module.exports = {
  generateFileNumber,
  generateInvoiceNumber,
  formatDate,
  getDayOfWeek,
  calculateFollowUpDate,
  calculateReminderDate,
  isDateToday,
  isDatePast
};
