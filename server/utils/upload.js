const multer = require('multer');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const imageFileFilter = (req, file, cb) => {
  if (['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
  }
};

const cloudinaryStorage = {
  _handleFile(req, file, cb) {
    const config = cloudinary.config();
    if (!config.cloud_name || !config.api_key || !config.api_secret) {
      const error = new Error('Cloudinary uploads are not configured');
      error.code = 'CLOUDINARY_NOT_CONFIGURED';
      return cb(error);
    }

    const stream = cloudinary.uploader.upload_stream(
      { folder: 'smartcut', resource_type: 'image' },
      (uploadError, result) => {
        if (uploadError) {
          const error = new Error('Cloudinary upload failed');
          error.code = 'CLOUDINARY_UPLOAD_FAILED';
          error.cause = uploadError;
          return cb(error);
        }
        if (!result?.secure_url || !result.public_id) {
          const error = new Error('Cloudinary returned an invalid upload result');
          error.code = 'CLOUDINARY_UPLOAD_FAILED';
          return cb(error);
        }
        cb(null, {
          path: result.secure_url,
          filename: result.public_id,
          size: result.bytes
        });
      }
    );

    file.stream.pipe(stream);
  },

  _removeFile(req, file, cb) {
    if (!file.filename) return cb(null);
    cloudinary.uploader.destroy(file.filename, { resource_type: 'image' }, error => cb(error));
  }
};

function createUpload() {
  return multer({
    storage: cloudinaryStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter
  });
}

module.exports = { createUpload };
