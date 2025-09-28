import type { FormSection, FormData } from './types.ts';

// FIX: Added parentheses around the object type to correctly define an array of objects. The original type was being misinterpreted due to operator precedence.
export const INITIAL_FORM_SECTIONS: (Omit<FormSection, 'items'> & { items: Omit<FormSection['items'][0], 'instances'>[] })[] = [
  {
    title: '1. Housekeeping & Cleanliness',
    items: [
      { id: '1.1', text: 'Dinding & Ventilasi', isRepeatable: true },
      { id: '1.2', text: 'Jendela', isRepeatable: true },
      { id: '1.3', text: 'Pintu', isRepeatable: true },
      { id: '1.4', text: 'Lantai & Tangga', isRepeatable: true },
      { id: '1.5', text: 'Jalur Pejalan Kaki', isRepeatable: true },
      { id: '1.6', text: 'Area Umum & Fasilitas', isRepeatable: true },
      { id: '1.7', text: 'Kebersihan Alat Berat', isRepeatable: true },
      { id: '1.8', text: 'Pengendalian Debu', isRepeatable: true },
    ],
  },
  {
    title: '2. Occupational Health & Safety',
    items: [
      { id: '2.1', text: 'Penggunaan APD', isRepeatable: true },
      { id: '2.2', text: 'Rambu & Marka Keselamatan', isRepeatable: true },
      { id: '2.3', text: 'Titik Kumpul', isRepeatable: true },
      { id: '2.4', text: 'P3K & Fasilitas Medis', isRepeatable: true },
      { id: '2.5', text: 'Manajemen Kebisingan', isRepeatable: true },
      { id: '2.6', text: 'Manajemen Lalu Lintas Kendaraan Berat', isRepeatable: true },
    ],
  },
  {
    title: '3. Material & Product Management',
    items: [
      { id: '3.1', text: 'Area Sampah Masuk/MSW', isRepeatable: true },
      { id: '3.2', text: 'Fasilitas Pengumpanan', isRepeatable: true },
      { id: '3.3', text: 'Proses RDF', isRepeatable: true },
      { id: '3.4', text: 'Produk RDF', isRepeatable: true },
      { id: '3.5', text: 'Penyimpanan RDF', isRepeatable: true },
      { id: '3.6', text: 'Kualitas Visual Produk RDF', isRepeatable: true },
      { id: '3.7', text: 'Ukuran', isRepeatable: true },
      { id: '3.8', text: 'Kelembaban', isRepeatable: true },
      { id: '3.9', text: 'Manajemen Lindi', isRepeatable: true },
      { id: '3.10', text: 'Kontrol Kualitas & Laboratorium (Sampel)', isRepeatable: true },
    ],
  },
  {
    title: '4. Equipment & Operational Condition',
    items: [
      { id: '4.1', text: 'Kondisi Mesin (Shredder, Conveyor)', isRepeatable: true },
      { id: '4.2', text: 'Sistem Proteksi Mesin (Guard, Interlock)', isRepeatable: true },
      { id: '4.3', text: 'Pemantauan Kondisi Mesin', isRepeatable: true },
      { id: '4.4', text: 'Sistem Proteksi Kebakaran', isRepeatable: true },
      { id: '4.5', text: 'Sistem Deteksi & Pemadaman Api Otomatis', isRepeatable: true },
    ],
  },
  {
    title: '5. Environmental Management & Compliance',
    items: [
      { id: '5.1', text: 'Sistem Manajemen Lindi', isRepeatable: true },
      { id: '5.2', text: 'Pengendalian Emisi Debu & Bau', isRepeatable: true },
      { id: '5.3', text: 'Manajemen Limbah B3 & Residu', isRepeatable: true },
      { id: '5.4', text: 'Kepatuhan terhadap Izin Lingkungan', isRepeatable: true },
    ],
  },
  {
    title: '6. Emergency Preparedness',
    items: [
      { id: '6.1', text: 'Prosedur Tanggap Darurat (ERP)', isRepeatable: true },
      { id: '6.2', text: 'Sistem Alarm & Komunikasi Darurat', isRepeatable: true },
      { id: '6.3', text: 'Pelatihan & Simulasi Tanggap Darurat', isRepeatable: true },
      { id: '6.4', text: 'Ketersediaan APAR & Hidran', isRepeatable: true },
    ],
  },
];


export const getInitialFormData = (): FormData => {
  const sectionsWithState: FormSection[] = INITIAL_FORM_SECTIONS.map(section => ({
    ...section,
    items: section.items.map(item => ({
      ...item,
      instances: [{
        status: null,
        description: '',
        photo: null,
      }]
    })),
  }));

  return {
    header: {
      assessmentDate: new Date().toISOString().split('T')[0],
      areaLocation: '',
      assessorName: '',
    },
    sections: sectionsWithState,
    followUp: {
      summary: '',
      recommendations: '',
      personInCharge: '',
      targetDate: '',
    },
  };
};