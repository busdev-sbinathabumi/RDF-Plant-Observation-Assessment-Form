
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";

// --- From utils.js ---
const debounce = (func, waitFor) => {
  let timeout = null;
  return (...args) =>
    new Promise(resolve => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
};

// --- From constants.js ---
const INITIAL_FORM_SECTIONS = [
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

const getInitialFormData = () => {
  const sectionsWithState = INITIAL_FORM_SECTIONS.map(section => ({
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


// --- From components/Modal.js ---
const Modal = ({ isOpen, onClose, children }) => {
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEsc);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 transition-opacity"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-lg shadow-xl transform transition-all sm:max-w-4xl w-full m-4 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 bg-gray-100 text-gray-800 rounded-full p-1 leading-none hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 z-10"
          aria-label="Close modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
};


// --- From components/CameraModal.js ---
const CameraModal = ({ isOpen, onClose, onCapture }) => {
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const videoRef = useRef(null);

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setCapturedImage(null);
      setRotation(0);
      const constraints = {
        video: { 
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: false,
      };
      navigator.mediaDevices.getUserMedia(constraints)
        .then(mediaStream => {
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
        })
        .catch(err => {
          console.error("Camera Error:", err);
          setError("Could not access the camera. Please check permissions.");
        });
    } else {
      stopStream();
    }
    return () => stopStream();
  }, [isOpen, facingMode, stopStream]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (video) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            setCapturedImage(canvas.toDataURL('image/jpeg'));
            stopStream();
        }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };
  
  const handleSwitchCamera = () => {
      stopStream();
      setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }

  const handleUsePhoto = () => {
    if (!capturedImage) return;
    const image = new Image();
    image.src = capturedImage;
    image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rad = rotation * Math.PI / 180;
        const isSideways = rotation === 90 || rotation === 270;
        canvas.width = isSideways ? image.height : image.width;
        canvas.height = isSideways ? image.width : image.height;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rad);
        ctx.drawImage(image, -image.width / 2, -image.height / 2);
        canvas.toBlob(blob => {
            if (blob) {
                const fileName = `capture-${new Date().toISOString()}.jpg`;
                const file = new File([blob], fileName, { type: 'image/jpeg' });
                onCapture(file);
            }
        }, 'image/jpeg', 0.95);
    };
  };
  
  const renderLiveView = () => (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      <video ref={videoRef} autoPlay playsInline muted className="max-w-full max-h-full" />
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-black bg-opacity-50 flex justify-around items-center">
        <button onClick={handleSwitchCamera} className="text-white p-2 rounded-full hover:bg-white/20" aria-label="Switch Camera">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5M5.528 9.5A6.995 6.995 0 0112 5a7 7 0 017 7h-2a5 5 0 00-5-5 4.975 4.975 0 00-4.555 3.003" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 20v-5h-5M18.472 14.5A6.995 6.995 0 0112 19a7 7 0 01-7-7h2a5 5 0 005 5 4.975 4.975 0 004.555-3.003" /></svg>
        </button>
        <button onClick={handleCapture} className="w-16 h-16 rounded-full bg-white border-4 border-gray-400 hover:opacity-80 transition-opacity" aria-label="Capture photo"></button>
        <div className="w-6 h-6"></div>
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      <img src={capturedImage} alt="Captured" className="max-w-full max-h-full transition-transform duration-300" style={{ transform: `rotate(${rotation}deg)`}} />
       <div className="absolute bottom-0 left-0 right-0 p-4 bg-black bg-opacity-50 flex justify-between items-center">
          <button onClick={handleRetake} className="text-white font-semibold py-2 px-4 rounded-lg hover:bg-white/20">Retake</button>
          <button onClick={handleRotate} className="text-white p-2 rounded-full hover:bg-white/20" aria-label="Rotate">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          </button>
          <button onClick={handleUsePhoto} className="bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-600">Use Photo</button>
       </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
        <div className="w-full h-[80vh] bg-gray-800 text-white flex flex-col items-center justify-center">
            {error && <div className="p-4 text-red-400 text-center">{error}<button onClick={onClose} className="block mx-auto mt-4 underline">Close</button></div>}
            {!error && (!capturedImage ? renderLiveView() : renderPreview())}
        </div>
    </Modal>
  );
};


// --- From components/ImageInput.js ---
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ImageInput = ({ file, onChange, onThumbnailClick }) => {
  const [preview, setPreview] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [isError, setIsError] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const validateAndSetFile = (selectedFile) => {
    if (!selectedFile) {
        onChange(null);
        return;
    }
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
        setIsError(true);
        setFeedbackMessage(`File exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
        onChange(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    } else {
        setIsError(false);
        setFeedbackMessage('Photo added successfully!');
        onChange(selectedFile);
    }
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    validateAndSetFile(selectedFile || null);
  };
  
  const handleRemoveImage = (e) => {
      e.stopPropagation();
      onChange(null);
      setFeedbackMessage(null);
      if(fileInputRef.current) {
          fileInputRef.current.value = "";
      }
  }

  const handleBrowseClick = () => fileInputRef.current?.click();
  const handlePreviewClick = () => {
    if (file && onThumbnailClick) onThumbnailClick(file);
  };
  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0 && droppedFiles[0].type.startsWith('image/')) {
      validateAndSetFile(droppedFiles[0]);
    }
  };
  const handleCapturePhoto = (capturedFile) => {
    validateAndSetFile(capturedFile);
    setIsCameraOpen(false);
  };

  return (
    <>
      <div>
        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" ref={fileInputRef} />
        {!preview ? (
          <div onDrop={handleDrop} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} className={`w-full p-4 border-2 border-dashed rounded-md flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors ${ isDraggingOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
            <div onClick={handleBrowseClick} className="w-full flex flex-col items-center justify-center cursor-pointer text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              <span>{isDraggingOver ? 'Drop file here' : 'Click or drag photo'}</span>
            </div>
            <span className="text-gray-400 text-xs my-2">OR</span>
            <button type="button" onClick={() => setIsCameraOpen(true)} className="flex items-center justify-center px-4 py-2 bg-gray-200 border border-transparent text-sm font-medium rounded-md text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" aria-label="Take a photo">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Take Photo
            </button>
          </div>
        ) : (
          <div className="relative w-full">
            <img src={preview} alt="Preview" onClick={handlePreviewClick} className={`w-full h-auto rounded-md ${onThumbnailClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`} />
            <button type="button" onClick={handleRemoveImage} aria-label="Remove image" className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 leading-none hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        {feedbackMessage && (<p className={`mt-2 text-sm text-center font-medium ${isError ? 'text-red-600' : 'text-green-600'}`}>{feedbackMessage}</p>)}
      </div>
      <CameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCapturePhoto} />
    </>
  );
};


// --- From components/ItemInstanceRow.js ---
const ItemInstanceRow = ({ item, instance, sectionIndex, itemIndex, instanceIndex, isInvalid, onStatusChange, onDescriptionChange, onPhotoChange, onRemove }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState('');
  
  const isMultiInstance = item.instances.length > 1;

  useEffect(() => {
    return () => { if (modalImageUrl) URL.revokeObjectURL(modalImageUrl); };
  }, [modalImageUrl]);

  const handleThumbnailClick = (file) => {
    if (modalImageUrl) URL.revokeObjectURL(modalImageUrl);
    const newUrl = URL.createObjectURL(file);
    setModalImageUrl(newUrl);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => setIsModalOpen(false);

  const itemText = isMultiInstance ? `${item.text} #${instanceIndex + 1}` : item.text;
  const itemIdText = isMultiInstance ? `${item.id}.${instanceIndex + 1}` : item.id;

  return (
    <>
      <div className={`border rounded-lg p-4 transition-all hover:shadow-md bg-white ${isInvalid ? 'border-red-500 border-2' : 'border-gray-200'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 mb-4 sm:mb-0">
            <p className="font-semibold text-gray-800"><span className={`mr-2 ${isInvalid ? 'text-red-500 font-bold' : 'text-blue-600'}`}>{itemIdText}</span>{itemText}</p>
          </div>
          <div className="flex items-center flex-wrap justify-start sm:justify-end gap-2 flex-shrink-0">
            <button type="button" onClick={() => onStatusChange(sectionIndex, itemIndex, instanceIndex, 'OK')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${ instance.status === 'OK' ? 'bg-green-500 text-white shadow-sm' : 'bg-gray-200 text-gray-700 hover:bg-green-100'}`}>OK</button>
            <button type="button" onClick={() => onStatusChange(sectionIndex, itemIndex, instanceIndex, 'Not OK')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${ instance.status === 'Not OK' ? 'bg-red-500 text-white shadow-sm' : 'bg-gray-200 text-gray-700 hover:bg-red-100'}`}>Not OK</button>
            <button type="button" onClick={() => onStatusChange(sectionIndex, itemIndex, instanceIndex, 'N/A')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${ instance.status === 'N/A' ? 'bg-gray-500 text-white shadow-sm' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>N/A</button>
            {isMultiInstance && (<button type="button" onClick={() => onRemove(sectionIndex, itemIndex, instanceIndex)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors" aria-label={`Hapus ${itemText}`}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>)}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description / Notes{instance.status === 'Not OK' && <span className="text-red-500 ml-1">*</span>}</label>
              <textarea value={instance.description} onChange={(e) => onDescriptionChange(sectionIndex, itemIndex, instanceIndex, e.target.value)} rows={3} className={`w-full p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${isInvalid && instance.status === 'Not OK' ? 'border-red-500' : 'border-gray-300'}`} placeholder="Explain the issue or add notes..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload Photo</label>
              <ImageInput file={instance.photo} onChange={(file) => onPhotoChange(sectionIndex, itemIndex, instanceIndex, file)} onThumbnailClick={handleThumbnailClick} />
            </div>
          </div>
        </div>
      </div>
      <Modal isOpen={isModalOpen} onClose={handleCloseModal}>{modalImageUrl && (<img src={modalImageUrl} alt="Full size preview" className="max-w-full max-h-[80vh] mx-auto rounded-md object-contain" />)}</Modal>
    </>
  );
};


// --- From components/AssessmentItemRow.js ---
const AssessmentItemRow = ({ item, sectionIndex, itemIndex, onStatusChange, onDescriptionChange, onPhotoChange, onAddItemInstance, onRemoveItemInstance, validationErrors }) => {
  return (
    <div className="space-y-4">
      {item.instances.map((instance, instanceIndex) => {
        const instanceId = `${item.id}-${instanceIndex}`;
        const isInvalid = validationErrors.includes(instanceId);
        return (<ItemInstanceRow key={instanceIndex} item={item} instance={instance} sectionIndex={sectionIndex} itemIndex={itemIndex} instanceIndex={instanceIndex} isInvalid={isInvalid} onStatusChange={onStatusChange} onDescriptionChange={onDescriptionChange} onPhotoChange={onPhotoChange} onRemove={onRemoveItemInstance} />)
      })}
      {item.isRepeatable && (
        <div className="pt-2">
          <button type="button" onClick={() => onAddItemInstance(sectionIndex, itemIndex)} className="w-full flex items-center justify-center px-4 py-2 border border-dashed border-gray-400 text-gray-600 rounded-md hover:bg-gray-100 hover:border-gray-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            Tambah {item.text}
          </button>
        </div>
      )}
    </div>
  );
};


// --- From components/AssessmentSection.js ---
const AssessmentSection = ({ section, sectionIndex, isOpen, onToggle, onStatusChange, onDescriptionChange, onPhotoChange, onAddItemInstance, onRemoveItemInstance, validationErrors }) => {
  return (
    <div className="mt-8 bg-white rounded-2xl shadow-lg overflow-hidden">
      <button type="button" className="w-full flex justify-between items-center p-4 sm:p-6 text-left" onClick={onToggle} aria-expanded={isOpen}>
        <h2 className="text-2xl font-bold text-gray-800">{section.title}</h2>
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-gray-500 transition-transform transform ${ isOpen ? 'rotate-180' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 sm:px-6 sm:pb-6 space-y-4">
          {section.items.map((item, itemIndex) => (<AssessmentItemRow key={item.id} item={item} sectionIndex={sectionIndex} itemIndex={itemIndex} onStatusChange={onStatusChange} onDescriptionChange={onDescriptionChange} onPhotoChange={onPhotoChange} onAddItemInstance={onAddItemInstance} onRemoveItemInstance={onRemoveItemInstance} validationErrors={validationErrors} />))}
        </div>
      )}
    </div>
  );
};


// --- From components/FollowUpSection.js ---
const FollowUpSection = ({ data, onChange, onGenerateSummary, isGenerating }) => {
  return (
    <div className="mt-8 bg-white p-4 sm:p-6 rounded-2xl shadow-lg">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">7. Notes & Follow-Up</h2>
        <button type="button" onClick={onGenerateSummary} disabled={isGenerating} className="w-full sm:w-auto mt-3 sm:mt-0 flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-purple-300 disabled:cursor-not-allowed">
            {isGenerating ? (<><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Generating...</>) : (<><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>Generate with AI</>)}
        </button>
      </div>
      <div className="space-y-4">
        <div><label htmlFor="summary" className="block text-sm font-medium text-gray-700 mb-1">Assessment Summary</label><textarea id="summary" rows={3} value={data.summary} onChange={(e) => onChange('summary', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder="General summary of the assessment results..."/></div>
        <div><label htmlFor="recommendations" className="block text-sm font-medium text-gray-700 mb-1">Recommended Corrective Actions</label><textarea id="recommendations" rows={3} value={data.recommendations} onChange={(e) => onChange('recommendations', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder="Suggested corrective steps..."/></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label htmlFor="personInCharge" className="block text-sm font-medium text-gray-700 mb-1">Person In Charge</label><input type="text" id="personInCharge" value={data.personInCharge} onChange={(e) => onChange('personInCharge', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder="Name of person in charge"/></div>
          <div><label htmlFor="targetDate" className="block text-sm font-medium text-gray-700 mb-1">Target Completion Date</label><input type="date" id="targetDate" value={data.targetDate} onChange={(e) => onChange('targetDate', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"/></div>
        </div>
      </div>
    </div>
  );
};


// --- From components/SummaryDashboard.js ---
const SummaryDashboard = ({ sections, filterOn, onFilterToggle }) => {
  const stats = useMemo(() => {
    let ok = 0, notOk = 0, na = 0, notFilled = 0;
    sections.forEach(section => {
      section.items.forEach(item => {
        item.instances.forEach(instance => {
          switch (instance.status) {
            case 'OK': ok++; break;
            case 'Not OK': notOk++; break;
            case 'N/A': na++; break;
            default: notFilled++; break;
          }
        });
      });
    });
    return { ok, notOk, na, notFilled };
  }, [sections]);

  return (
    <div className="mt-8 bg-white p-4 sm:p-6 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Assessment Summary</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-center">
        <div className="bg-green-100 text-green-800 p-3 rounded-lg"><p className="text-xl sm:text-2xl font-bold">{stats.ok}</p><p className="text-sm">OK</p></div>
        <div className="bg-red-100 text-red-800 p-3 rounded-lg"><p className="text-xl sm:text-2xl font-bold">{stats.notOk}</p><p className="text-sm">Not OK</p></div>
        <div className="bg-gray-100 text-gray-800 p-3 rounded-lg"><p className="text-xl sm:text-2xl font-bold">{stats.na}</p><p className="text-sm">N/A</p></div>
        <div className="bg-yellow-100 text-yellow-800 p-3 rounded-lg"><p className="text-xl sm:text-2xl font-bold">{stats.notFilled}</p><p className="text-sm">Not Filled</p></div>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-200">
        <label htmlFor="filterToggle" className="text-sm font-medium text-gray-700">Show only 'Not OK' items</label>
        <div className="relative inline-block w-10 align-middle select-none transition duration-200 ease-in">
            <input type="checkbox" name="filterToggle" id="filterToggle" checked={filterOn} onChange={(e) => onFilterToggle(e.target.checked)} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
            <label htmlFor="filterToggle" className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
        </div>
        <style>{`.toggle-checkbox:checked { right: 0; border-color: #48bb78; } .toggle-checkbox:checked + .toggle-label { background-color: #48bb78; }`}</style>
      </div>
    </div>
  );
};


// --- From components/FormHeader.js ---
const FormHeader = ({ data, onChange }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-200 pt-6">
      <div><label htmlFor="assessmentDate" className="block text-sm font-medium text-gray-700 mb-1">Assessment Date</label><input type="date" id="assessmentDate" value={data.assessmentDate} onChange={(e) => onChange('assessmentDate', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" required /></div>
      <div><label htmlFor="areaLocation" className="block text-sm font-medium text-gray-700 mb-1">Area/Location</label><input type="text" id="areaLocation" value={data.areaLocation} onChange={(e) => onChange('areaLocation', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., Warehouse A" required /></div>
      <div><label htmlFor="assessorName" className="block text-sm font-medium text-gray-700 mb-1">Assessor Name</label><input type="text" id="assessorName" value={data.assessorName} onChange={(e) => onChange('assessorName', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder="Assessor's full name" required /></div>
    </div>
  );
};


// --- Main App Component Logic ---
const DEFAULT_RECIPIENT_EMAIL = 'area.report@example.com';
const LOCAL_STORAGE_KEY = 'rdf-plant-assessment-draft';

const App = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingEmail, setIsExportingEmail] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [openSectionIndex, setOpenSectionIndex] = useState(0);
  const [filterNotOK, setFilterNotOK] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState(DEFAULT_RECIPIENT_EMAIL);
  const [validationErrors, setValidationErrors] = useState([]);
  const [formData, setFormData] = useState(getInitialFormData());

  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedDraft) {
        const parsedData = JSON.parse(savedDraft);
        if (parsedData.header && parsedData.sections && parsedData.followUp) {
            if (window.confirm("A saved draft was found. Would you like to restore it?")) {
                const restoredSections = parsedData.sections.map((section) => ({
                    ...section,
                    items: section.items.map((item) => ({
                        ...item,
                        instances: item.instances.map((instance) => {
                            let photoFile = null;
                            if (instance.photo) {
                                try {
                                    const byteCharacters = atob(instance.photo.base64);
                                    const byteNumbers = new Array(byteCharacters.length);
                                    for (let i = 0; i < byteCharacters.length; i++) {
                                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                                    }
                                    const byteArray = new Uint8Array(byteNumbers);
                                    photoFile = new File([byteArray], instance.photo.name, { type: instance.photo.type });
                                } catch(e) { console.error("Error restoring photo from base64:", e); }
                            }
                            return { ...instance, photo: photoFile };
                        })
                    }))
                }));
                setFormData({ ...parsedData, sections: restoredSections });
            }
        }
      }
    } catch (error) { console.error("Failed to load draft from localStorage", error); }
  }, []);

  const saveToLocalStorage = useCallback(debounce(async (data) => {
    try {
        const serializableSections = await Promise.all(data.sections.map(async (section) => ({
            ...section,
            items: await Promise.all(section.items.map(async (item) => ({
                ...item,
                instances: await Promise.all(item.instances.map(async (instance) => {
                    let serializablePhoto = null;
                    if (instance.photo) {
                        const toBase64 = (file) => new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.readAsDataURL(file);
                            reader.onload = () => resolve((reader.result).split(',')[1]);
                            reader.onerror = error => reject(error);
                        });
                        serializablePhoto = {
                            name: instance.photo.name,
                            type: instance.photo.type,
                            base64: await toBase64(instance.photo)
                        };
                    }
                    return { ...instance, photo: serializablePhoto };
                }))
            }))
        })));
        const dataToStore = { ...data, sections: serializableSections };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToStore));
    } catch (error) { console.error("Failed to save draft to localStorage", error); }
  }, 500), []);
  
  useEffect(() => { saveToLocalStorage(formData); }, [formData, saveToLocalStorage]);

  const validateForm = useCallback(() => {
    const errors = [];
    let firstErrorSectionIndex = null;
    let hasNullStatus = false;
    let hasMissingDescription = false;
    formData.sections.forEach((section, sectionIndex) => {
      section.items.forEach((item) => {
        item.instances.forEach((instance, instanceIndex) => {
          const instanceId = `${item.id}-${instanceIndex}`;
          let isInvalid = false;
          if (instance.status === null) { isInvalid = true; hasNullStatus = true; } 
          else if (instance.status === 'Not OK' && !instance.description.trim()) { isInvalid = true; hasMissingDescription = true; }
          if (isInvalid) {
            errors.push(instanceId);
            if (firstErrorSectionIndex === null) firstErrorSectionIndex = sectionIndex;
          }
        });
      });
    });
    setValidationErrors(errors);
    if (errors.length > 0) {
      let alertMessage = 'Form is incomplete!\n';
      if (hasNullStatus) alertMessage += '- Please complete all assessment statuses (OK/Not OK/N/A).\n';
      if (hasMissingDescription) alertMessage += '- Please fill in the description for all items with "Not OK" status.\n';
      alert(alertMessage);
      if (firstErrorSectionIndex !== null && openSectionIndex !== firstErrorSectionIndex) setOpenSectionIndex(firstErrorSectionIndex);
      return false;
    }
    return true;
  }, [formData.sections, openSectionIndex]);

  const handleHeaderChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, header: { ...prev.header, [field]: value } }));
  }, []);

  const handleStatusChange = useCallback((sectionIndex, itemIndex, instanceIndex, status) => {
    setFormData(prev => {
      const newSections = JSON.parse(JSON.stringify(prev.sections));
      const item = newSections[sectionIndex].items[itemIndex];
      const instance = item.instances[instanceIndex];
      const newStatus = instance.status === status ? null : status;
      item.instances[instanceIndex] = { ...instance, status: newStatus };
      const instanceId = `${item.id}-${instanceIndex}`;
      if (newStatus === 'Not OK' && !instance.description.trim()) {
          if (!validationErrors.includes(instanceId)) setValidationErrors(prevErrors => [...prevErrors, instanceId]);
      } else if (newStatus !== null) {
          setValidationErrors(prevErrors => prevErrors.filter(err => err !== instanceId));
      }
      const originalInstance = prev.sections[sectionIndex].items[itemIndex].instances[instanceIndex];
      item.instances[instanceIndex].photo = originalInstance.photo;
      return { ...prev, sections: newSections };
    });
  }, [validationErrors]);

  const handleDescriptionChange = useCallback((sectionIndex, itemIndex, instanceIndex, description) => {
    setFormData(prev => {
        const newSections = JSON.parse(JSON.stringify(prev.sections));
        const item = newSections[sectionIndex].items[itemIndex];
        const instance = item.instances[instanceIndex];
        item.instances[instanceIndex] = { ...instance, description };
        const instanceId = `${item.id}-${instanceIndex}`;
        if (instance.status === 'Not OK' && description.trim() !== '') {
            setValidationErrors(prevErrors => prevErrors.filter(err => err !== instanceId));
        }
        const originalInstance = prev.sections[sectionIndex].items[itemIndex].instances[instanceIndex];
        item.instances[instanceIndex].photo = originalInstance.photo;
        return { ...prev, sections: newSections };
    });
  }, []);

  const handlePhotoChange = useCallback((sectionIndex, itemIndex, instanceIndex, photo) => {
     setFormData(prev => {
        const newSections = [...prev.sections];
        newSections[sectionIndex].items[itemIndex].instances[instanceIndex].photo = photo;
        return { ...prev, sections: newSections };
    });
  }, []);
  
  const handleAddItemInstance = useCallback((sectionIndex, itemIndex) => {
    setFormData(prev => {
        const newSections = [...prev.sections];
        newSections[sectionIndex].items[itemIndex].instances.push({ status: null, description: '', photo: null });
        return { ...prev, sections: newSections };
    });
  }, []);

  const handleRemoveItemInstance = useCallback((sectionIndex, itemIndex, instanceIndex) => {
    setFormData(prev => {
       const item = prev.sections[sectionIndex].items[itemIndex];
       if (item.instances.length <= 1) return prev;
       const instanceId = `${item.id}-${instanceIndex}`;
       setValidationErrors(prevErrors => prevErrors.filter(err => err !== instanceId));
       const newSections = [...prev.sections];
       newSections[sectionIndex].items[itemIndex].instances.splice(instanceIndex, 1);
       return { ...prev, sections: newSections };
    });
  }, []);

  const handleFollowUpChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, followUp: { ...prev.followUp, [field]: value } }));
  }, []);

  const handleToggleSection = useCallback((sectionIndex) => {
    setOpenSectionIndex(prevIndex => (prevIndex === sectionIndex ? null : sectionIndex));
  }, []);
  
  const displayedSections = useMemo(() => {
    if (!filterNotOK) return formData.sections;
    return formData.sections
      .map(section => ({
        ...section,
        items: section.items.map(item => ({
          ...item,
          instances: item.instances.filter(instance => instance.status === 'Not OK'),
        })).filter(item => item.instances.length > 0),
      }))
      .filter(section => section.items.length > 0);
  }, [formData.sections, filterNotOK]);

  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
        const notOkItems = formData.sections.flatMap(section =>
            section.items.flatMap(item =>
                item.instances.map((instance, index) => ({ ...instance, text: item.text, isMulti: item.instances.length > 1, index })).filter(instance => instance.status === 'Not OK' && instance.description)
            )
        );
        if (notOkItems.length === 0) {
            alert("No 'Not OK' items with descriptions found to generate a summary.");
            setIsGeneratingSummary(false);
            return;
        }
        const issues = notOkItems.map(item => `- ${(item.isMulti ? `${item.text} #${item.index + 1}` : item.text)}: ${item.description}`).join('\n');
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const schema = { type: Type.OBJECT, properties: { summary: { type: Type.STRING, description: 'A concise summary of all the issues found, written in professional language.' }, recommendations: { type: Type.STRING, description: 'A list of actionable corrective steps. Each recommendation should be on a new line and start with a hyphen.' } } };
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Based on the following list of 'Not OK' items from a plant inspection, please generate a summary and a list of recommended corrective actions.\n\nIssues:\n${issues}`,
            config: { systemInstruction: "You are a professional safety and operations inspector. Your task is to analyze reported issues and provide a concise summary and actionable recommendations.", responseMimeType: "application/json", responseSchema: schema },
        });
        const result = JSON.parse(response.text.trim());
        setFormData(prev => ({ ...prev, followUp: { ...prev.followUp, summary: result.summary || prev.followUp.summary, recommendations: result.recommendations || prev.followUp.recommendations } }));
    } catch (error) {
        console.error("Error generating summary with AI:", error);
        alert("Failed to generate summary. Please check the console for details.");
    } finally { setIsGeneratingSummary(false); }
  };

  const handleExportToEmail = () => {
    if (!validateForm()) return;
    setIsEmailModalOpen(true);
  };

  const handleConfirmExportToEmail = () => {
    if (!validateForm()) { setIsEmailModalOpen(false); return; }
    setIsExportingEmail(true);
    setIsEmailModalOpen(false);
    try {
      const { header, sections, followUp } = formData;
      const subject = `Area Assessment Report - ${header.areaLocation} - ${header.assessmentDate}`;
      let body = `Area Assessment Report\n\nDate: ${header.assessmentDate}\nArea/Location: ${header.areaLocation}\nAssessor: ${header.assessorName}\n\n--------------------------------------\n\nSUMMARY OF "NOT OK" ITEMS\n\n`;
      let hasNotOkItems = false;
      sections.forEach(section => {
        const notOkItems = section.items.flatMap(item => item.instances.map((inst, idx) => ({ ...inst, text: item.text, isMulti: item.instances.length > 1, instanceIndex: idx })).filter(inst => inst.status === 'Not OK'));
        if (notOkItems.length > 0) {
          hasNotOkItems = true;
          body += `SECTION: ${section.title}\n`;
          notOkItems.forEach(item => { body += `- Item: ${(item.isMulti ? `${item.text} #${item.instanceIndex + 1}` : item.text)}\n  Description: ${item.description}\n\n`; });
        }
      });
      if (!hasNotOkItems) body += `No items with "Not OK" status.\n\n`;
      body += `--------------------------------------\n\nNOTES & FOLLOW-UP\n\nSummary: ${followUp.summary}\nRecommendations: ${followUp.recommendations}\nPerson In Charge: ${followUp.personInCharge}\nTarget Completion Date: ${followUp.targetDate}\n`;
      window.location.href = `mailto:${emailRecipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } catch (error) {
        console.error("Failed to create email:", error);
        alert("An error occurred while trying to create the email. Please try again.");
    } finally { setIsExportingEmail(false); }
  };

  const handleExportToPDF = async () => {
    if (!validateForm()) return;
    setIsExporting(true);
    const originalFilterState = filterNotOK;
    setFilterNotOK(false);
    const originalOpenSection = openSectionIndex;
    setOpenSectionIndex(-1); // Use -1 to signify all open for rendering
    await new Promise(resolve => setTimeout(resolve, 500)); 
    const input = document.getElementById('app-container');
    if (!input) {
      console.error("Root element not found for PDF export");
      setIsExporting(false);
      setFilterNotOK(originalFilterState);
      setOpenSectionIndex(originalOpenSection);
      return;
    }
    try {
      const canvas = await window.html2canvas(input, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = pdfWidth * (canvas.height / canvas.width);
      let heightLeft = imgHeight, position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();
      while (heightLeft > 0) {
          position -= pdf.internal.pageSize.getHeight();
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
          heightLeft -= pdf.internal.pageSize.getHeight();
      }
      pdf.save(`Assessment_Report_${formData.header.areaLocation.replace(/\s/g, '_')}_${formData.header.assessmentDate}.pdf`);
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      alert("Failed to export to PDF. Please try again.");
    } finally {
      setIsExporting(false);
      setFilterNotOK(originalFilterState);
      setOpenSectionIndex(originalOpenSection);
    }
  };
  
  const handleConfirmClear = () => {
    setFormData(getInitialFormData());
    setValidationErrors([]);
    setOpenSectionIndex(0);
    setFilterNotOK(false);
    setIsClearModalOpen(false);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  return (
    <div id="app-container" className="container mx-auto p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
          <div>
             <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 tracking-tight">RDF Plant Observation & Assessment Report</h1>
             <p className="text-lg text-gray-600">PT Solusi Bangun Indonesia</p>
          </div>
          <div><img src="https://aistudiocdn.com/sbi_logo.png" alt="Logo Solusi Bangun Indonesia" className="h-12 sm:h-16" /></div>
        </header>

        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-4">General Information</h2>
          <FormHeader data={formData.header} onChange={handleHeaderChange} />
        </div>

        <SummaryDashboard sections={formData.sections} filterOn={filterNotOK} onFilterToggle={setFilterNotOK} />

        {displayedSections.map((section) => {
          const originalIndex = formData.sections.findIndex(s => s.title === section.title);
          if (originalIndex === -1) return null;
          return (<AssessmentSection key={section.title} section={section} sectionIndex={originalIndex} isOpen={openSectionIndex === originalIndex || openSectionIndex === -1} onToggle={() => handleToggleSection(originalIndex)} onStatusChange={handleStatusChange} onDescriptionChange={handleDescriptionChange} onPhotoChange={handlePhotoChange} onAddItemInstance={handleAddItemInstance} onRemoveItemInstance={handleRemoveItemInstance} validationErrors={validationErrors}/>);
        })}

        <FollowUpSection data={formData.followUp} onChange={handleFollowUpChange} onGenerateSummary={handleGenerateSummary} isGenerating={isGeneratingSummary}/>

        <div className="mt-10 pt-6 border-t border-gray-200 flex flex-col sm:flex-row justify-end items-center gap-4">
          <button onClick={() => setIsClearModalOpen(true)} className="w-full sm:w-auto flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">Clear All</button>
          <button onClick={handleExportToEmail} disabled={isExportingEmail} className="w-full sm:w-auto flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed">
            {isExportingEmail ? (<><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Preparing...</>) : 'Send Report via Email'}
          </button>
          <button onClick={handleExportToPDF} disabled={isExporting} className="w-full sm:w-auto flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300 disabled:cursor-not-allowed">
            {isExporting ? (<><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Exporting...</>) : 'Export to PDF'}
          </button>
        </div>
      </div>

      <Modal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)}>
        <div className="p-4">
          <h3 className="text-lg font-medium leading-6 text-gray-900" id="modal-title">Send Report via Email</h3>
          <div className="mt-2"><p className="text-sm text-gray-500">Enter the recipient's email address. A summary of "Not OK" items and follow-up notes will be included in the email body.</p></div>
          <div className="mt-4"><label htmlFor="email-recipient" className="block text-sm font-medium text-gray-700">Recipient Email Address</label><input type="email" id="email-recipient" value={emailRecipient} onChange={(e) => setEmailRecipient(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" placeholder="recipient@example.com"/></div>
          <div className="mt-5 sm:mt-6 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => setIsEmailModalOpen(false)} className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Cancel</button>
            <button type="button" onClick={handleConfirmExportToEmail} className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Send</button>
          </div>
        </div>
      </Modal>
      
      <Modal isOpen={isClearModalOpen} onClose={() => setIsClearModalOpen(false)}>
        <div className="p-4">
          <h3 className="text-lg font-medium leading-6 text-gray-900" id="modal-title">Confirm Clear Form</h3>
          <div className="mt-2"><p className="text-sm text-gray-500">Are you sure you want to clear all form data? This action cannot be undone.</p></div>
          <div className="mt-5 sm:mt-6 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => setIsClearModalOpen(false)} className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Cancel</button>
            <button type="button" onClick={handleConfirmClear} className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">Clear Form</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default App;
