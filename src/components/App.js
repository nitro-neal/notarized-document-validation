import React, { Fragment } from "react";
import { Button, FormGroup, Input, Label } from "reactstrap";
import { ReactComponent as UploadSvg } from "../img/upload-drop.svg";
import CryptoJS from "crypto-js";
import Dropzone from "react-dropzone";

class App extends React.Component {
  state = { files: [], fileMD5: "", did: "" };

  handleDidChange = (e) => {
    this.setState({ did: e.target.value });
  };

  handleOnDrop = async (files) => {
    console.log(files[0]);

    const fileMD5 = await this.fileToMd5(files[0]);
    this.setState({ fileMD5: fileMD5 });

    files = files.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      })
    );

    this.setState({ files: files });
  };

  fileToMd5 = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", function () {
        const hash = CryptoJS.MD5(CryptoJS.enc.Latin1.parse(this.result));
        console.log("MD5");
        console.log(hash.toString(CryptoJS.enc.Hex));
        resolve(hash.toString(CryptoJS.enc.Hex));
      });

      reader.readAsBinaryString(file);
    });
  };

  renderDidForm() {
    return (
      <FormGroup>
        <Label for="documentTypeSelected" className="prompt">
          What is the DID for this document?
        </Label>
        <Input
          type="text"
          name="didInput"
          id="didInput"
          value={this.state.did}
          onChange={this.handleDidChange}
          placeholder="did:ethr:..."
        />
      </FormGroup>
    );
  }

  renderFileUploadDropzone() {
    const { files } = { ...this.state };

    return (
      <Dropzone onDrop={this.handleOnDrop}>
        {({ getRootProps, getInputProps }) => (
          <section className="dropzone-container">
            {files.length <= 0 && this.renderForm(getRootProps, getInputProps)}
            {files.length > 0 && this.renderFiles(files)}
          </section>
        )}
      </Dropzone>
    );
  }

  renderFiles(files) {
    if (files.length > 0) {
      const [oneFile] = [...files];
      return <img src={oneFile.preview} alt={""} />;
    } else {
      return <Fragment />;
    }
  }

  renderForm(getRootProps, getInputProps) {
    return (
      <div {...getRootProps()} className="dropzone-form">
        <input {...getInputProps()} />
        <div className="upload">
          <div className="caption">Upload your file by dropping it here...</div>
          <UploadSvg />
        </div>
      </div>
    );
  }

  render() {
    return (
      <div className="container">
        <div className="row">
          <div className="col"></div>
          <div className="col-8 text-center">
            {this.renderDidForm()}
            {this.renderFileUploadDropzone()}
            {this.state.fileMD5}
          </div>
          <div className="col"></div>
        </div>
      </div>
    );
  }
}
export default App;
