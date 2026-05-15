import React from 'react';
import { Modal } from './Modal';
import { Button, cn } from './ui';
import { AlertTriangle } from 'lucide-react';

export function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message,
  confirmText = 'حذف',
  confirmVariant = 'danger'
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  title: string; 
  message: string;
  confirmText?: string;
  confirmVariant?: 'danger' | 'primary';
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="text-center space-y-4">
        <div className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center mx-auto",
          confirmVariant === 'danger' ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
        )}>
          <AlertTriangle className="w-8 h-8" />
        </div>
        <p className="text-gray-600 leading-relaxed">{message}</p>
        <div className="flex gap-3 pt-2">
          <Button 
            className="flex-1 rounded-xl h-12" 
            variant={confirmVariant as any} 
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </Button>
          <Button 
            className="flex-1 rounded-xl h-12" 
            variant="outline" 
            onClick={onClose}
          >
            إلغاء
          </Button>
        </div>
      </div>
    </Modal>
  );
}
