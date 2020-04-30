import React, { Fragment } from "react";
import { Button, FormGroup, Input, Label } from "reactstrap";
import { ReactComponent as UploadSvg } from "../img/upload-drop.svg";
import { ReactComponent as CheckboxChecked } from "../img/checkbox-checked.svg";
import CryptoJS from "crypto-js";
import Dropzone from "react-dropzone";
import { Document, Page, pdfjs } from "react-pdf";
import axios from "axios";
import { verifyCredential } from "did-jwt-vc";
import { Resolver } from "did-resolver";
import { getResolver } from "ethr-did-resolver";
import Web3 from "web3";

import "./accordion.scss";

const ENS_REGISTRY_PUBLIC_RESOLVER_ABI_JSON = require("../contracts/publicResolverAbi.json");
const ENS_REGISTRY_PUBLIC_RESOLVER_ADDRESS =
  "0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41";
const ENS_NODE =
  "0x3442daf145b62820466398f343a5666abd6b41e9144476431b4360e0007a214e";
const INFURA_URI = "https://mainnet.infura.io/v3/";
const INFURA_PROJECT_ID = "f89f8f95ce6c4199849037177b155d08";

const web3 = new Web3(
  new Web3.providers.HttpProvider(INFURA_URI + INFURA_PROJECT_ID)
);

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

const ensContract = new web3.eth.Contract(
  JSON.parse(ENS_REGISTRY_PUBLIC_RESOLVER_ABI_JSON.result),
  ENS_REGISTRY_PUBLIC_RESOLVER_ADDRESS
);

const providerConfig = {
  name: "rsk:testnet",
  registry: "0xdca7ef03e98e0dc2b855be647c39abe984fcf21b",
  rpcUrl: "https://did.testnet.rsk.co:4444",
};

const UNIRESOLVER_API = "https://uniresolver.io/1.0/identifiers/";

class App extends React.Component {
  state = {
    files: [],
    fileMD5: "",
    jwtMD5: "",
    pdfLink: "",
    did: "did:ethr:0x27dFC5414aa6Ca1515411392581e71af2Ef0B921",
    signer: "",
    signerName: "",
    jwt: "",
    numPages: null,
    pageNumber: 1,
  };

  componentDidMount = () => {
    const resolver = new Resolver(getResolver(providerConfig));
    this.setState({ resolver: resolver });
  };

  handleDidChange = (e) => {
    this.setState({ did: e.target.value });
  };

  handleOnDrop = async (files) => {
    files = files.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      })
    );

    const fileMD5 = await this.fileToMd5(files[0]);

    this.setState({ fileMD5: fileMD5 });
    this.setState({ files: files });
    this.setState({ pdfLink: files[0].preview });
  };

  handleFileSubmit = async (e) => {
    const jwtResponse = await axios.get(UNIRESOLVER_API + this.state.did);
    const jwt = jwtResponse.data.didDocument.service[0].serviceEndpoint;

    let verifiedVC;
    try {
      verifiedVC = await verifyCredential(jwt, this.state.resolver);
    } catch (e) {
      console.log(e);
      this.setState({ error: e.message });
      return;
    }

    const signerDid = verifiedVC.signer.owner;
    const signerName = await this.getTxtRecord(signerDid);
    const jwtMD5 =
      verifiedVC.payload.vc.credentialSubject.TexasNotary.documentHash;

    this.setState({ decodedJwt: JSON.stringify(verifiedVC) });
    this.setState({ signer: JSON.stringify(verifiedVC.signer) });
    this.setState({ jwt });
    this.setState({ signerName });
    this.setState({ jwtMD5 });
  };

  onDocumentLoadSuccess = ({ numPages }) => {
    this.setState({ numPages });
  };

  fileToMd5 = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", function () {
        const hash = CryptoJS.MD5(CryptoJS.enc.Latin1.parse(this.result));
        resolve(hash.toString(CryptoJS.enc.Hex));
      });

      reader.readAsBinaryString(file);
    });
  };

  getTxtRecord = async (didKey) => {
    let res = await ensContract.methods.text(ENS_NODE, didKey).call();
    return res;
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
            {files.length > 0 && this.renderPreview(files)}
          </section>
        )}
      </Dropzone>
    );
  }

  renderPreview(files) {
    if (files.length > 0) {
      const [oneFile] = [...files];
      return (
        <div>
          <Document
            file={oneFile.preview}
            onLoadSuccess={this.onDocumentLoadSuccess}
          >
            <Page pageNumber={this.state.pageNumber} />
          </Document>
          <p>
            <a
              href="#"
              onClick={() => {
                if (this.state.pageNumber - 1 >= 1) {
                  this.setState({ pageNumber: this.state.pageNumber - 1 });
                }
              }}
            >
              {" "}
              prev{" "}
            </a>
            Page {this.state.pageNumber} of {this.state.numPages}
            <a
              href="#"
              onClick={() => {
                if (this.state.pageNumber + 1 <= this.state.numPages) {
                  this.setState({ pageNumber: this.state.pageNumber + 1 });
                }
              }}
            >
              {" "}
              next{" "}
            </a>
          </p>
        </div>
      );
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

  renderJWT() {
    return (
      <div>
        <Label className="prompt">JWT:</Label>;<p>{this.state.jwt}</p>
      </div>
    );
  }

  renderSubmitButton() {
    return (
      <Button
        className="margin-wide"
        color="primary"
        // disabled={!this.state.files[0]}
        onClick={this.handleFileSubmit}
      >
        Submit
      </Button>
    );
  }

  renderTabs() {
    return (
      <div class="tabs">
        <div class="tab">
          <input class="accordion-input" type="checkbox" id="chck1" />
          <label class="tab-label" for="chck1">
            <CheckboxChecked /> JWT
          </label>
          <div class="tab-content">{this.state.jwt}</div>
        </div>
        <div class="tab">
          <input class="accordion-input" type="checkbox" id="chck2" />
          <label class="tab-label" for="chck2">
            <CheckboxChecked /> JWT Payload
          </label>
          <div class="tab-content">{this.state.decodedJwt}</div>
        </div>
        <div class="tab">
          <input class="accordion-input" type="checkbox" id="chck3" />
          <label class="tab-label" for="chck3">
            <CheckboxChecked />
            Signer
          </label>
          <div class="tab-content">
            {this.state.signer}
            <CheckboxChecked /> Verified Mypass Notary - {this.state.signerName}
          </div>
        </div>

        <div class="tab">
          <input class="accordion-input" type="checkbox" id="chck4" />
          <label class="tab-label" for="chck4">
            <CheckboxChecked /> Timestamp
          </label>
          <div class="tab-content">{this.state.jwt}</div>
        </div>

        <div class="tab">
          <input class="accordion-input" type="checkbox" id="chck5" />
          <label class="tab-label" for="chck5">
            <CheckboxChecked /> Image Hash
          </label>
          <div class="tab-content">
            Document Hash: {this.state.fileMD5} VS Did Document Hash:{" "}
            {this.state.jwtMD5}
          </div>
        </div>
      </div>
    );
  }

  render() {
    return (
      <div className="container">
        <div className="row">
          <div className="col"></div>
          <div className="col-9 text-center">
            {this.renderDidForm()}
            {this.renderFileUploadDropzone()}
            {this.renderSubmitButton()}
            <hr />
            {this.renderTabs()}
          </div>
          <div className="col"></div>
        </div>
      </div>
    );
  }
}
export default App;
