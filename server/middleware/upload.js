const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const uploadDir = path.join(__dirname, '../uploads');
const cloudinaryEnabled = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const imageFileFilter = (req, file, cb) => {
  if (['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
  }
};

const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.fieldname}${path.extname(file.originalname)}`);
  },
});

const cloudinaryStorage = {
  _handleFile(req, file, cb) {
    const chunks = [];
    file.stream.on('data', (chunk) => chunks.push(chunk));
    file.stream.on('error', cb);
    file.stream.on('end', () => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'smartcut', resource_type: 'image' },
        (error, result) => {
          if (error) return cb(error);
          cb(null, {
            filename: result.public_id,
            path: result.secure_url,
            cloudinaryUrl: result.secure_url,
            size: Buffer.concat(chunks).length,
          });
        }
      );
      uploadStream.end(Buffer.concat(chunks));
    });
  },
  _removeFile(req, file, cb) {
    cb(null);
  },
};

function createUploadStorage() {
  return cloudinaryEnabled ? cloudinaryStorage : localStorage;
}

function uploadedFileUrl(file) {
  if (!file) return null;
  return file.cloudinaryUrl || `/uploads/${file.filename}`;
}

function createUpload(options = {}) {
  return multer({
    storage: createUploadStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    ...options,
  });
}

module.exports = { createUpload, imageFileFilter, uploadedFileUrl, cloudinaryEnabled };
