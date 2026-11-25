// How each marketplace category looks: the dot beside its name, and the tile and icon shown
// when a listing has no photo. Keys are the categories in data/sample.js.
const STYLES = {
  'Textbooks': { dot: '#C2410C', tint: '#FFE4CF', icon: 'book-open' },
  'Electronics': { dot: '#0E7490', tint: '#D4EEF2', icon: 'headphones' },
  'Dorm Essentials': { dot: '#6D28D9', tint: '#E9DFFB', icon: 'lamp' },
  'Sports': { dot: '#4D7C0F', tint: '#DEF0CB', icon: 'dumbbell' },
  'Lab Gear': { dot: '#1D4ED8', tint: '#DCE6FD', icon: 'flask-conical' },
  'Project Kits': { dot: '#A16207', tint: '#F8EBC4', icon: 'cpu' },
  'Clothing & Event Wear': { dot: '#BE185D', tint: '#FBDDEB', icon: 'shirt' },
  'F&B': { dot: '#B91C1C', tint: '#FADCD9', icon: 'utensils' },
}
const OTHER = { dot: '#8A877F', tint: '#EFEDE6', icon: 'package' }

export const categoryStyle = (category) => STYLES[category] || OTHER
