import crypto from 'node:crypto';

const name = Buffer.from('mokel-backup.enc');
function crc(bytes) {
 let value = -1;
 for (const byte of bytes) {
  value ^= byte;
  for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
 }
 return (value ^ -1) >>> 0;
}
function key(password, salt) {
 if (typeof password !== 'string' || password.length < 4 || password.length > 256) throw Error('Use a backup password of 4 to 256 characters.');
 return crypto.scryptSync(password, salt, 32);
}
export function packBackup(data, password) {
 const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
 const cipher = crypto.createCipheriv('aes-256-gcm', key(password, salt), iv);
 const encrypted = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
 const payload = Buffer.concat([salt, iv, cipher.getAuthTag(), encrypted]);
 const checksum = crc(payload);
 const local = Buffer.alloc(30), directory = Buffer.alloc(46), end = Buffer.alloc(22);
 local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4);
 directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
 for (const [header, offset] of [[local,14],[directory,16]]) {
  header.writeUInt32LE(checksum, offset);
  header.writeUInt32LE(payload.length, offset + 4);
  header.writeUInt32LE(payload.length, offset + 8);
  header.writeUInt16LE(name.length, offset + 12);
 }
 end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
 end.writeUInt32LE(directory.length + name.length, 12);
 end.writeUInt32LE(local.length + name.length + payload.length, 16);
 return Buffer.concat([local,name,payload,directory,name,end]);
}
export function unpackBackup(zip, password) {
 const offset = 30 + name.length;
 if (zip.length < offset + 44 + 46 + name.length + 22 || zip.readUInt32LE() !== 0x04034b50 ||
     zip.readUInt16LE(6) !== 0 || zip.readUInt16LE(8) !== 0 || zip.readUInt16LE(26) !== name.length ||
     zip.readUInt16LE(28) !== 0 || !zip.subarray(30,offset).equals(name)) throw Error('Choose a Mokel workspace ZIP.');
 const size = zip.readUInt32LE(18);
 if (size + offset + 46 + name.length + 22 !== zip.length) throw Error('The workspace ZIP is incomplete.');
 const bytes = zip.subarray(offset,offset + size);
 const secret = key(password,bytes.subarray(0,16));
 try {
  const decipher = crypto.createDecipheriv('aes-256-gcm',secret,bytes.subarray(16,28));
  decipher.setAuthTag(bytes.subarray(28,44));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(44)),decipher.final()]).toString());
 } catch {
  throw Error('Incorrect backup password or damaged workspace ZIP.');
 }
}
