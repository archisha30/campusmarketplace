// Sample data shaped exactly like the FastAPI response models, so swapping
// VITE_DATA_SOURCE to "live" changes nothing about how components read it.

export const CATEGORIES = [
  'Textbooks', 'Lab Gear', 'Electronics', 'Dorm Essentials',
  'Project Kits', 'Sports', 'Clothing & Event Wear',
]
export const CONDITIONS = ['New', 'Like New', 'Good', 'Fair']
export const LISTING_TYPES = [
  { value: 'sale', label: 'Sell' },
  { value: 'rent', label: 'Rent' },
  { value: 'free', label: 'Free / Giveaway' },
]
export const RESOURCE_CATEGORIES = ['Notes', 'PYQs', 'Lab Work', 'Cheat Sheets', 'Study Guides', 'Reference Links']

export const campuses = [
  { id: 1, name: 'Polaris Campus', email_domain: 'polaris.edu', location: 'Bengaluru', is_active: true },
  { id: 2, name: 'Northgate Campus', email_domain: 'northgate.edu', location: 'Bengaluru', is_active: true },
  { id: 3, name: 'Riverdale Campus', email_domain: 'riverdale.edu', location: 'Mysuru', is_active: false },
]

export const currentUser = {
  id: 1, name: 'Aashi K.', email: 'aashi@polaris.edu', campus_id: 1, campus: 'Polaris Campus',
  course: 'AI/ML', year: '2nd Year', role: 'admin', verified: true,
}

const seller = (id, name, campus_id) => ({
  id, name, campus_id, campus: campuses.find((c) => c.id === campus_id).name, verified: true,
})

export const listings = [
  { id: 1, title: 'Engineering Drawing Kit', category: 'Lab Gear', listing_type: 'sale', price: 450,
    condition: 'Good', status: 'available', pickup_spot: 'Library Foyer', campus_id: 1,
    seller: seller(2, 'Rhea M.', 1), art: { emoji: '📐', bg: '#EAF0FF' }, created_at: '2026-09-10',
    description: 'Complete drafting set — compass, scale, set squares. Used for one semester of ED, barely any wear.' },
  { id: 2, title: 'Casio fx-991CW', category: 'Electronics', listing_type: 'sale', price: 900,
    condition: 'Good', status: 'available', pickup_spot: 'Library Foyer', campus_id: 1,
    seller: seller(1, 'Aashi K.', 1), art: { emoji: '🧮', bg: '#FFF3D6' }, created_at: '2026-09-11',
    description: 'Latest ClassWiz scientific calculator. Comes with the slide cover, works perfectly.' },
  { id: 3, title: 'Adjustable Study Lamp', category: 'Dorm Essentials', listing_type: 'sale', price: 350,
    condition: 'Like New', status: 'available', pickup_spot: 'Hostel Gate B', campus_id: 2,
    seller: seller(3, 'Dev S.', 2), art: { emoji: '💡', bg: '#FFECEA' }, created_at: '2026-09-09',
    description: 'USB-powered LED desk lamp with three brightness modes. Moving out, barely used.' },
  { id: 4, title: 'Arduino Starter Kit', category: 'Project Kits', listing_type: 'rent', price: 150,
    condition: 'Good', status: 'available', pickup_spot: 'CS Block Lobby', campus_id: 1,
    seller: seller(4, 'Wren T.', 1), art: { emoji: '🔌', bg: '#EAFBF0' }, created_at: '2026-09-12',
    description: 'Breadboard, sensors, jumper wires, the lot. Weekly rent during project season.' },
  { id: 5, title: 'Data Structures Textbook', category: 'Textbooks', listing_type: 'free', price: 0,
    condition: 'Fair', status: 'available', pickup_spot: 'Main Gate', campus_id: 3,
    seller: seller(5, 'Kabir A.', 3), art: { emoji: '📘', bg: '#F1EAFF' }, created_at: '2026-09-08',
    description: 'Some highlighting inside but every page intact. Free to whoever needs it next.' },
  { id: 6, title: 'Mini Fridge (45L)', category: 'Dorm Essentials', listing_type: 'sale', price: 2800,
    condition: 'Good', status: 'reserved', pickup_spot: 'Hostel Block C', campus_id: 1,
    seller: seller(6, 'Ishaan P.', 1), art: { emoji: '🧊', bg: '#E7F6FF' }, created_at: '2026-09-07',
    description: 'Compact fridge that fits under a dorm desk. Selling because I graduate this semester.' },
  { id: 7, title: 'Badminton Racket Set', category: 'Sports', listing_type: 'sale', price: 600,
    condition: 'Like New', status: 'available', pickup_spot: 'Sports Complex', campus_id: 2,
    seller: seller(7, 'Meher L.', 2), art: { emoji: '🏸', bg: '#FFF0F5' }, created_at: '2026-09-06',
    description: 'Pair of rackets plus three shuttlecocks. Played with twice.' },
  { id: 8, title: 'Farewell Blazer (M)', category: 'Clothing & Event Wear', listing_type: 'rent', price: 200,
    condition: 'Good', status: 'sold', pickup_spot: 'Girls Hostel Lobby', campus_id: 1,
    seller: seller(1, 'Aashi K.', 1), art: { emoji: '🧥', bg: '#FFF6E0' }, created_at: '2026-09-05',
    description: 'Navy blazer, size M. Good for farewell or a first interview.' },
]

export const resources = [
  { id: 1, course_code: 'CS201', title: 'Data Structures — Past Year Questions', department: 'Computer Science',
    semester: '3rd Semester', category: 'PYQs', helpful_count: 42, resource_url: '#',
    contributor: { id: 1, name: 'Aashi K.', verified: true },
    description: 'Four years of PYQs sorted by topic, with the recurring question patterns marked.' },
  { id: 2, course_code: 'MA104', title: 'Linear Algebra — Full Semester Notes', department: 'Mathematics',
    semester: '2nd Semester', category: 'Notes', helpful_count: 31, resource_url: '#',
    contributor: { id: 2, name: 'Rhea M.', verified: true },
    description: 'Handwritten notes from vector spaces through eigenvalues, scanned and ordered by week.' },
  { id: 3, course_code: 'EE210', title: 'Circuits Lab — Manual & Observations', department: 'Electrical Engineering',
    semester: '3rd Semester', category: 'Lab Work', helpful_count: 18, resource_url: '#',
    contributor: { id: 3, name: 'Dev S.', verified: true },
    description: 'Lab manual with worked observations for all eight experiments.' },
  { id: 4, course_code: 'CS305', title: 'DBMS Cheat Sheet', department: 'Computer Science',
    semester: '5th Semester', category: 'Cheat Sheets', helpful_count: 56, resource_url: '#',
    contributor: { id: 4, name: 'Wren T.', verified: true },
    description: 'One page covering normalization, SQL joins, and transaction isolation levels.' },
  { id: 5, course_code: 'PH101', title: 'Physics I — Study Guide', department: 'Physics',
    semester: '1st Semester', category: 'Study Guides', helpful_count: 24, resource_url: '#',
    contributor: { id: 5, name: 'Kabir A.', verified: true },
    description: 'Concept summaries with solved examples across mechanics and thermodynamics.' },
]

export const reports = [
  { id: 1, listing_id: 6, listing_title: 'Mini Fridge (45L)', reporter: 'Anonymous student',
    reason: 'Incorrect information', created_at: '12 Sep', status: 'open' },
  { id: 2, listing_id: 8, listing_title: 'Farewell Blazer (M)', reporter: 'Priya N.',
    reason: 'Spam', created_at: '10 Sep', status: 'open' },
]

export const users = [
  { id: 1, name: 'Aashi K.', college: 'Polaris School of Technology', email: 'aashi@polaris.edu', status: 'active', role: 'admin' },
  { id: 2, name: 'Rhea M.', college: 'Polaris School of Technology', email: 'rhea@polaris.edu', status: 'active', role: 'student' },
  { id: 3, name: 'Dev S.', college: 'Northgate University', email: 'dev@northgate.edu', status: 'suspended', role: 'student' },
  { id: 4, name: 'Wren T.', college: 'Polaris School of Technology', email: 'wren@polaris.edu', status: 'active', role: 'student' },
]

export const REPORT_REASONS = ['Scam / suspicious', 'Prohibited item', 'Incorrect information', 'Spam', 'Other']
