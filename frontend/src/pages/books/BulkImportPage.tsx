import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { bookService } from '@/services/book.service';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface ImportResult {
  imported: number;
  errors: string[];
}

interface CsvPreviewRow {
  [key: string]: string;
}

const SAMPLE_CSV_CONTENT = `title,author,isbn,publisher,publicationYear,edition,category,language,pages,shelfLocation,callNumber,totalCopies,availableCopies,condition,price,description
"The Great Gatsby","F. Scott Fitzgerald","9780743273565","Scribner",1925,"1st","Fiction","English",180,"A-1-01","PS3511.I9 G7",3,3,"good",12.99,"A novel about the American Dream"
"Introduction to Algorithms","Thomas H. Cormen","9780262033848","MIT Press",2009,"3rd","Computer Science","English",1312,"B-2-05","QA76.6 .C662",5,4,"excellent",89.99,"Comprehensive textbook on algorithms"
"A Brief History of Time","Stephen Hawking","9780553380163","Bantam",1998,"Updated","Science","English",212,"C-3-08","QB981 .H377",2,2,"good",18.00,"Popular science book on cosmology"`;

function parseCsvPreview(text: string): { headers: string[]; rows: CsvPreviewRow[] } {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows: CsvPreviewRow[] = [];

  const maxPreview = Math.min(lines.length, 6); // Header + 5 rows
  for (let i = 1; i < maxPreview; i++) {
    const values = parseRow(lines[i]);
    const row: CsvPreviewRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

export default function BulkImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: CsvPreviewRow[] } | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB.');
      return;
    }

    setSelectedFile(file);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        const parsed = parseCsvPreview(text);
        if (parsed.headers.length === 0) {
          toast.error('The CSV file appears to be empty.');
          setSelectedFile(null);
          setPreview(null);
          return;
        }
        setPreview(parsed);
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read the file.');
      setSelectedFile(null);
    };
    reader.readAsText(file);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreview(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const response = await bookService.bulkImport(selectedFile);
      setImportResult(response.data);
      if (response.data.errors.length === 0) {
        toast.success(`Successfully imported ${response.data.imported} books.`);
      } else {
        toast.success(
          `Imported ${response.data.imported} books with ${response.data.errors.length} errors.`
        );
      }
    } catch {
      toast.error('Failed to import books. Please check your file and try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'books_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/books"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Books
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-gray-900">Bulk Import Books</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload a CSV file to import multiple books at once.
        </p>
      </div>

      {/* Instructions and template download */}
      <div className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">CSV Format Requirements</h2>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-500" />
                First row must contain column headers
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-500" />
                Required columns: title, author, isbn, category, shelfLocation, callNumber, totalCopies
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-500" />
                Optional columns: publisher, publicationYear, edition, language, pages, availableCopies, condition, price, description
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-500" />
                Use double quotes for values containing commas
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-500" />
                Maximum file size: 10MB
              </li>
            </ul>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="btn-secondary inline-flex flex-shrink-0 items-center gap-2"
          >
            <Download size={16} />
            Download Template
          </button>
        </div>
      </div>

      {/* Upload area */}
      <div className="card">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Upload File</h2>

        {!selectedFile ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
              isDragging
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
            }`}
          >
            <div className="flex flex-col items-center">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-full mb-4 ${
                  isDragging ? 'bg-primary-100' : 'bg-gray-100'
                }`}
              >
                <Upload
                  size={28}
                  className={isDragging ? 'text-primary-600' : 'text-gray-400'}
                />
              </div>
              <p className="text-base font-medium text-gray-700">
                {isDragging ? 'Drop your file here' : 'Drag and drop your CSV file here'}
              </p>
              <p className="mt-1 text-sm text-gray-500">or click to browse files</p>
              <p className="mt-3 text-xs text-gray-400">Accepted format: .csv (max 10MB)</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                  <FileSpreadsheet size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                    {preview && ` - ${preview.rows.length} row${preview.rows.length !== 1 ? 's' : ''} previewed`}
                  </p>
                </div>
              </div>
              <button
                onClick={handleRemoveFile}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
                title="Remove file"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {/* Preview table */}
      {preview && preview.rows.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">
              Preview
              <span className="ml-2 text-sm font-normal text-gray-500">
                (showing first {preview.rows.length} row{preview.rows.length !== 1 ? 's' : ''})
              </span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  {preview.headers.slice(0, 8).map((header) => (
                    <th
                      key={header}
                      className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                  {preview.headers.length > 8 && (
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400">
                      +{preview.headers.length - 8} more
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.rows.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-400">{index + 1}</td>
                    {preview.headers.slice(0, 8).map((header) => (
                      <td
                        key={header}
                        className="px-4 py-2.5 text-gray-700 max-w-[200px] truncate"
                        title={row[header]}
                      >
                        {row[header] || <span className="text-gray-300">---</span>}
                      </td>
                    ))}
                    {preview.headers.length > 8 && (
                      <td className="px-4 py-2.5 text-gray-300">...</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import button */}
      {selectedFile && !importResult && (
        <div className="flex justify-end">
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="btn-primary inline-flex items-center gap-2 px-6"
          >
            {isImporting ? (
              <>
                <LoadingSpinner />
                Importing...
              </>
            ) : (
              <>
                <Upload size={16} />
                Import Books
              </>
            )}
          </button>
        </div>
      )}

      {/* Import results */}
      {importResult && (
        <div className="card space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Import Results</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Success count */}
            <div className="flex items-center gap-4 rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">{importResult.imported}</p>
                <p className="text-sm text-green-600">
                  book{importResult.imported !== 1 ? 's' : ''} imported successfully
                </p>
              </div>
            </div>

            {/* Error count */}
            <div
              className={`flex items-center gap-4 rounded-xl border p-4 ${
                importResult.errors.length > 0
                  ? 'border-red-200 bg-red-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full ${
                  importResult.errors.length > 0 ? 'bg-red-100' : 'bg-gray-100'
                }`}
              >
                {importResult.errors.length > 0 ? (
                  <XCircle size={24} className="text-red-600" />
                ) : (
                  <CheckCircle2 size={24} className="text-gray-400" />
                )}
              </div>
              <div>
                <p
                  className={`text-2xl font-bold ${
                    importResult.errors.length > 0 ? 'text-red-700' : 'text-gray-500'
                  }`}
                >
                  {importResult.errors.length}
                </p>
                <p
                  className={`text-sm ${
                    importResult.errors.length > 0 ? 'text-red-600' : 'text-gray-500'
                  }`}
                >
                  error{importResult.errors.length !== 1 ? 's' : ''} encountered
                </p>
              </div>
            </div>
          </div>

          {/* Error details */}
          {importResult.errors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-red-600" />
                <h3 className="text-sm font-semibold text-red-800">Error Details</h3>
              </div>
              <ul className="space-y-1.5 max-h-60 overflow-y-auto">
                {importResult.errors.map((error, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-red-700">
                    <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-red-200 text-[10px] font-bold text-red-700">
                      {index + 1}
                    </span>
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons after import */}
          <div className="flex items-center gap-3 pt-2">
            <Link to="/books" className="btn-primary inline-flex items-center gap-2">
              View All Books
            </Link>
            <button
              onClick={handleRemoveFile}
              className="btn-secondary inline-flex items-center gap-2"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
