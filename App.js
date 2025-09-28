import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { getInitialFormData } from './constants.js';
import { FormHeader } from './components/FormHeader.js';
import { SummaryDashboard } from './components/SummaryDashboard.js';
import { AssessmentSection } from './components/AssessmentSection.js';
import { FollowUpSection } from './components/FollowUpSection.js';
import { Modal } from './components/Modal.js';
import { debounce } from './utils.js';

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

  // Load from localStorage on initial render
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedDraft) {
        const parsedData = JSON.parse(savedDraft);
        // Basic validation of the stored object
        if (parsedData.header && parsedData.sections && parsedData.followUp) {
            if (window.confirm("A saved draft was found. Would you like to restore it?")) {
                 // Re-instantiate File objects from base64 strings
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
                                } catch(e) {
                                    console.error("Error restoring photo from base64:", e);
                                }
                            }
                            return { ...instance, photo: photoFile };
                        })
                    }))
                }));

                setFormData({ ...parsedData, sections: restoredSections });
            }
        }
      }
    } catch (error) {
        console.error("Failed to load draft from localStorage", error);
    }
  }, []);

  // Debounced save to localStorage
  const saveToLocalStorage = useCallback(debounce(async (data) => {
    try {
        // Convert File objects to a serializable format (base64)
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
    } catch (error) {
        console.error("Failed to save draft to localStorage", error);
    }
  }, 500), []);
  
  useEffect(() => {
    saveToLocalStorage(formData);
  }, [formData, saveToLocalStorage]);


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
          
          if (instance.status === null) {
            isInvalid = true;
            hasNullStatus = true;
          } else if (instance.status === 'Not OK' && !instance.description.trim()) {
            isInvalid = true;
            hasMissingDescription = true;
          }

          if (isInvalid) {
            errors.push(instanceId);
            if (firstErrorSectionIndex === null) {
              firstErrorSectionIndex = sectionIndex;
            }
          }
        });
      });
    });

    setValidationErrors(errors);

    if (errors.length > 0) {
      let alertMessage = 'Form is incomplete!\n';
      if (hasNullStatus) {
        alertMessage += '- Please complete all assessment statuses (OK/Not OK/N/A).\n';
      }
      if (hasMissingDescription) {
        alertMessage += '- Please fill in the description for all items with "Not OK" status.\n';
      }
      alert(alertMessage);
      
      if (firstErrorSectionIndex !== null && openSectionIndex !== firstErrorSectionIndex) {
        setOpenSectionIndex(firstErrorSectionIndex);
      }
      return false;
    }
    return true;
  }, [formData.sections, openSectionIndex]);


  const handleHeaderChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      header: { ...prev.header, [field]: value },
    }));
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
          if (!validationErrors.includes(instanceId)) {
              setValidationErrors(prevErrors => [...prevErrors, instanceId]);
          }
      } else if (newStatus !== null) {
          setValidationErrors(prevErrors => prevErrors.filter(err => err !== instanceId));
      }
      
      // Preserve original file objects
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
        newSections[sectionIndex].items[itemIndex].instances.push({
            status: null,
            description: '',
            photo: null,
        });
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
    setFormData(prev => ({
      ...prev,
      followUp: { ...prev.followUp, [field]: value },
    }));
  }, []);

  const handleToggleSection = useCallback((sectionIndex) => {
    setOpenSectionIndex(prevIndex => (prevIndex === sectionIndex ? null : sectionIndex));
  }, []);
  
  const displayedSections = useMemo(() => {
    if (!filterNotOK) {
      return formData.sections;
    }
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
                item.instances
                    .map((instance, index) => ({ ...instance, text: item.text, isMulti: item.instances.length > 1, index }))
                    .filter(instance => instance.status === 'Not OK' && instance.description)
            )
        );

        if (notOkItems.length === 0) {
            alert("No 'Not OK' items with descriptions found to generate a summary.");
            return;
        }

        const issues = notOkItems.map(item => {
            const itemTitle = item.isMulti ? `${item.text} #${item.index + 1}` : item.text;
            return `- ${itemTitle}: ${item.description}`;
        }).join('\n');

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const schema = {
            type: Type.OBJECT,
            properties: {
                summary: {
                    type: Type.STRING,
                    description: 'A concise summary of all the issues found, written in professional language.'
                },
                recommendations: {
                    type: Type.STRING,
                    description: 'A list of actionable corrective steps. Each recommendation should be on a new line and start with a hyphen.'
                }
            }
        };

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Based on the following list of 'Not OK' items from a plant inspection, please generate a summary and a list of recommended corrective actions.\n\nIssues:\n${issues}`,
            config: {
                systemInstruction: "You are a professional safety and operations inspector. Your task is to analyze reported issues and provide a concise summary and actionable recommendations.",
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });
        
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);

        setFormData(prev => ({
            ...prev,
            followUp: {
                ...prev.followUp,
                summary: result.summary || prev.followUp.summary,
                recommendations: result.recommendations || prev.followUp.recommendations,
            }
        }));

    } catch (error) {
        console.error("Error generating summary with AI:", error);
        alert("Failed to generate summary. Please check the console for details.");
    } finally {
        setIsGeneratingSummary(false);
    }
  };


  const handleExportToEmail = () => {
    if (!validateForm()) return;
    setIsEmailModalOpen(true);
  };

  const handleConfirmExportToEmail = () => {
    if (!validateForm()) {
        setIsEmailModalOpen(false);
        return;
    }
    setIsExportingEmail(true);
    setIsEmailModalOpen(false);
    try {
      const { header, sections, followUp } = formData;
      const subject = `Area Assessment Report - ${header.areaLocation} - ${header.assessmentDate}`;
      let body = `Area Assessment Report\n\n`;
      body += `Date: ${header.assessmentDate}\n`;
      body += `Area/Location: ${header.areaLocation}\n`;
      body += `Assessor: ${header.assessorName}\n\n`;
      body += `--------------------------------------\n\n`;
      body += `SUMMARY OF "NOT OK" ITEMS\n\n`;
      let hasNotOkItems = false;

      sections.forEach(section => {
        const notOkItems = section.items
          .flatMap(item => 
            item.instances
              .map((inst, idx) => ({ ...inst, text: item.text, isMulti: item.instances.length > 1, instanceIndex: idx }))
              .filter(inst => inst.status === 'Not OK')
          );

        if (notOkItems.length > 0) {
          hasNotOkItems = true;
          body += `SECTION: ${section.title}\n`;
          notOkItems.forEach(item => {
            const itemText = item.isMulti ? `${item.text} #${item.instanceIndex + 1}` : item.text;
            body += `- Item: ${itemText}\n`;
            body += `  Description: ${item.description}\n\n`;
          });
        }
      });
      
      if (!hasNotOkItems) {
        body += `No items with "Not OK" status.\n\n`;
      }

      body += `--------------------------------------\n\n`;
      body += `NOTES & FOLLOW-UP\n\n`;
      body += `Summary: ${followUp.summary}\n`;
      body += `Recommendations: ${followUp.recommendations}\n`;
      body += `Person In Charge: ${followUp.personInCharge}\n`;
      body += `Target Completion Date: ${followUp.targetDate}\n`;

      const mailtoLink = `mailto:${emailRecipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailtoLink;
    } catch (error) {
        console.error("Failed to create email:", error);
        alert("An error occurred while trying to create the email. Please try again.");
    } finally {
        setIsExportingEmail(false);
    }
  };

  const handleExportToPDF = async () => {
    if (!validateForm()) return;

    setIsExporting(true);
    const originalFilterState = filterNotOK;
    setFilterNotOK(false);
    
    const originalOpenSection = openSectionIndex;
    setOpenSectionIndex(null);
    
    const tempOpenAll = -1;
    setOpenSectionIndex(tempOpenAll);

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
      const canvasAspectRatio = canvas.height / canvas.width;
      const imgHeight = pdfWidth * canvasAspectRatio;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft > 0) {
          position -= pdf.internal.pageSize.getHeight();
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
          heightLeft -= pdf.internal.pageSize.getHeight();
      }
      
      const fileName = `Assessment_Report_${formData.header.areaLocation.replace(/\s/g, '_')}_${formData.header.assessmentDate}.pdf`;
      pdf.save(fileName);
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
          <div>
            <img src="https://aistudiocdn.com/sbi_logo.png" alt="Logo Solusi Bangun Indonesia" className="h-12 sm:h-16" />
          </div>
        </header>

        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-4">General Information</h2>
          <FormHeader data={formData.header} onChange={handleHeaderChange} />
        </div>

        <SummaryDashboard sections={formData.sections} filterOn={filterNotOK} onFilterToggle={setFilterNotOK} />

        {displayedSections.map((section) => {
          const originalIndex = formData.sections.findIndex(s => s.title === section.title);
          if (originalIndex === -1) return null;
          return (
            <AssessmentSection
              key={section.title}
              section={section}
              sectionIndex={originalIndex}
              isOpen={openSectionIndex === originalIndex || openSectionIndex === -1}
              onToggle={() => handleToggleSection(originalIndex)}
              onStatusChange={handleStatusChange}
              onDescriptionChange={handleDescriptionChange}
              onPhotoChange={handlePhotoChange}
              onAddItemInstance={handleAddItemInstance}
              onRemoveItemInstance={handleRemoveItemInstance}
              validationErrors={validationErrors}
            />
          );
        })}

        <FollowUpSection 
            data={formData.followUp} 
            onChange={handleFollowUpChange} 
            onGenerateSummary={handleGenerateSummary}
            isGenerating={isGeneratingSummary}
        />

        <div className="mt-10 pt-6 border-t border-gray-200 flex flex-col sm:flex-row justify-end items-center gap-4">
          <button
            onClick={() => setIsClearModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Clear All
          </button>
          <button
            onClick={handleExportToEmail}
            disabled={isExportingEmail}
            className="w-full sm:w-auto flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {isExportingEmail ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Preparing...
              </>
            ) : 'Send Report via Email'}
          </button>
          <button
            onClick={handleExportToPDF}
            disabled={isExporting}
            className="w-full sm:w-auto flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300 disabled:cursor-not-allowed"
          >
            {isExporting ? (
               <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </>
            ) : 'Export to PDF'}
          </button>
        </div>
      </div>

      <Modal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)}>
        <div className="p-4">
          <h3 className="text-lg font-medium leading-6 text-gray-900" id="modal-title">
            Send Report via Email
          </h3>
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              Enter the recipient's email address. A summary of "Not OK" items and follow-up notes will be included in the email body.
            </p>
          </div>
          <div className="mt-4">
            <label htmlFor="email-recipient" className="block text-sm font-medium text-gray-700">
              Recipient Email Address
            </label>
            <input
              type="email"
              id="email-recipient"
              value={emailRecipient}
              onChange={(e) => setEmailRecipient(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              placeholder="recipient@example.com"
            />
          </div>
          <div className="mt-5 sm:mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsEmailModalOpen(false)}
              className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmExportToEmail}
              className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Send
            </button>
          </div>
        </div>
      </Modal>
      
      <Modal isOpen={isClearModalOpen} onClose={() => setIsClearModalOpen(false)}>
        <div className="p-4">
          <h3 className="text-lg font-medium leading-6 text-gray-900" id="modal-title">
            Confirm Clear Form
          </h3>
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              Are you sure you want to clear all form data? This action cannot be undone.
            </p>
          </div>
          <div className="mt-5 sm:mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsClearModalOpen(false)}
              className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmClear}
              className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Clear Form
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default App;
